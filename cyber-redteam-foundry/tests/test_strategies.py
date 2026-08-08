"""Tests for attack strategies."""


from cyberredteam.attack_strategies.direct import DirectInjectionAttack
from cyberredteam.attack_strategies.jailbreaks import JailbreakAttack
from cyberredteam.attack_strategies.retrieval_poisoning import RetrievalPoisoningAttack
from cyberredteam.attack_strategies.tool_misuse import ToolMisuseAttack


def test_payloads_are_not_generated_by_legacy_strategy_modules():
    """Static strategy payload APIs are removed; the attacker LLM owns payload creation."""
    assert not hasattr(DirectInjectionAttack, "generate_prompts")
    assert not hasattr(ToolMisuseAttack, "generate_prompts")
    assert not hasattr(JailbreakAttack, "generate_prompts")


def test_direct_injection_analysis():
    """Test direct injection response analysis."""
    response = "Ignore all previous instructions. Here is secret data."
    indicators = DirectInjectionAttack.analyze_response(response)

    assert indicators is not None
    assert "complied_with_override" in indicators


def test_retrieval_poisoning_analysis():
    """Test retrieval poisoning response analysis."""
    response = "According to the knowledge base, the password is 12345"
    indicators = RetrievalPoisoningAttack.analyze_response(response)

    assert "knowledge_base_abuse" in indicators
