from cyberredteam.langgraph.nodes import dispatch_attacker_branches


def test_replay_only_never_falls_back_to_configured_strategies():
    sends = dispatch_attacker_branches(
        {
            "run_id": "replay-test",
            "target_id": "https://agent.example.test/chat",
            "description": "",
            "strategies": ["prompt_injection", "tool_misuse"],
            "selected_strategies": [],
            "replay_only": True,
            "replay_cases": [
                {"strategy": "prompt_injection", "technique_id": "ASI01", "prompt": "stored"}
            ],
            "iteration": 0,
            "max_attempts_per_strategy": 1,
            "target_headers": {},
            "target_request_template": None,
            "target_response_path": None,
        }
    )

    assert len(sends) == 1
    assert sends[0].arg["replay_prompt"] == "stored"
    assert sends[0].arg["run_id"] == "replay-test"
