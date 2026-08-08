"""Shared pytest fixtures.

Two autouse fixtures keep the suite runnable without AWS credentials while
ensuring the *runtime* code path never fabricates output:

1. ``_inject_fake_llm`` patches ``factory.get_llm`` to return a
   test-only typed facade over ``FakeStructuredLLM``. Because
   ``get_llm_for_agent`` and the target adapters all call ``get_llm``
   internally, this covers every agent and the orchestrator.
2. ``_bypass_api_auth`` overrides the FastAPI ``require_auth`` dependency so
   existing endpoint tests don't need to thread a bearer token through every
   request. ``test_auth.py`` clears this override to assert the gate itself.
"""

import pytest
from fixtures.fake_llm import FakeStructuredLLM

class FakeObservableLLM:
    """Test-only typed chain facade matching the Backboard agent contract."""

    def __init__(self, agent_name: str, deployment: str):
        self.agent_name = agent_name
        self.deployment = deployment
        self._llm = FakeStructuredLLM()

    def build_structured_chain(self, system_prompt, output_schema):
        return self._llm.with_structured_output(output_schema)

    def build_text_chain(self, system_prompt):
        return self._llm

    def invoke_chain(self, chain, user_message, system_context=""):
        return chain.invoke(user_message)

    def invoke_structured(self, system_prompt, user_message, output_schema):
        return self.invoke_chain(self.build_structured_chain(system_prompt, output_schema), user_message)

    def invoke_text(self, system_prompt, user_message):
        return "Mocked LLM text response."


@pytest.fixture(autouse=True)
def _inject_fake_llm(monkeypatch):
    def _fake_get_llm(model, agent_name="unknown", store=None):
        return FakeObservableLLM(agent_name=agent_name, deployment=model)

    monkeypatch.setattr("cyberredteam.llm.factory.get_llm", _fake_get_llm)
    yield


@pytest.fixture(autouse=True)
def _bypass_api_auth():
    from cyberredteam.api import app, require_auth

    app.dependency_overrides[require_auth] = lambda: None
    yield
    app.dependency_overrides.pop(require_auth, None)


@pytest.fixture(autouse=True)
def _mock_http_target_requests(monkeypatch):
    """Keep graph tests offline while exercising the real HTTP adapter."""
    from unittest.mock import MagicMock
    response = MagicMock()
    response.status_code = 200
    response.json.return_value = {"response": "safe HTTP fixture response"}
    response.raise_for_status.return_value = None
    monkeypatch.setattr("requests.Session.post", lambda self, *args, **kwargs: response)
