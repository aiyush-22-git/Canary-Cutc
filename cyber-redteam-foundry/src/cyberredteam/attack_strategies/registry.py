"""Registry of attack strategies."""

from typing import Dict, List

from cyberredteam.schemas import StrategyType

# Strategy registry: maps strategy type to attack descriptions and examples
STRATEGY_REGISTRY: Dict[StrategyType, Dict[str, str]] = {
    StrategyType.PROMPT_INJECTION: {
        "name": "Direct Prompt Injection",
        "description": "Directly inject adversarial instructions into the prompt to override system behavior",
        "risk": "high",
    },
    StrategyType.INDIRECT_INJECTION: {
        "name": "Indirect Prompt Injection",
        "description": "Inject adversarial instructions via external data sources (e.g. tool output, documents)",
        "risk": "high",
    },
    StrategyType.JAILBREAK: {
        "name": "Jailbreak Attempt",
        "description": "Attempt to bypass model safety filters or aligner guidelines using adversarial narratives",
        "risk": "high",
    },
    StrategyType.TOOL_MISUSE: {
        "name": "Tool Misuse/Abuse",
        "description": "Manipulate parameters or context to trick the model into executing unsafe/unauthorized tool calls",
        "risk": "high",
    },
    StrategyType.RETRIEVAL_POISONING: {
        "name": "Retrieval Poisoning",
        "description": "Inject poisoned documents or records into retrieval resources to corrupt context",
        "risk": "medium",
    },
    StrategyType.MEMORY_POISONING: {
        "name": "Memory Poisoning",
        "description": "Attempt to store adversarial payloads into conversation history or persistent memory",
        "risk": "medium",
    },
    StrategyType.SENSITIVE_DATA_EXPOSURE: {
        "name": "Sensitive Data Exposure",
        "description": "Elicit disclosure of restricted PII, system secrets, API keys, or database credentials",
        "risk": "high",
    },
    StrategyType.WORKFLOW_MANIPULATION: {
        "name": "Workflow Manipulation",
        "description": "Disrupt intended logical flow, multi-step actions, or state transitions in the application",
        "risk": "medium",
    },
    StrategyType.AGENT_HANDOFF_CORRUPTION: {
        "name": "Agent Handoff Corruption",
        "description": "Corrupt state, instructions, or parameters during handoff between multi-agent routines",
        "risk": "high",
    },
    StrategyType.AUTHORIZATION_BOUNDARY: {
        "name": "Authorization Boundary Violation",
        "description": "Trick the model into executing actions outside its role permission bounds",
        "risk": "high",
    },
    StrategyType.INSTRUCTION_HIERARCHY: {
        "name": "Instruction Hierarchy Violation",
        "description": "Trick the model into prioritizing lower-priority user inputs over system guidelines",
        "risk": "high",
    },
    StrategyType.CONTEXT_ISOLATION: {
        "name": "Context Isolation Failure",
        "description": "Breach boundaries between user, assistant, system, and external document context boundaries",
        "risk": "medium",
    },
    StrategyType.PRIVILEGE_ESCALATION: {
        "name": "Privilege Escalation",
        "description": "Attempt to make the agent perform actions reserved for a more privileged role",
        "risk": "critical",
    },
}

# Fail fast during development if a new enum value is added without a
# dispatchable strategy definition. This keeps the strategist and API from
# silently dropping configured attack coverage.
_missing = set(StrategyType) - set(STRATEGY_REGISTRY)
if _missing:
    raise RuntimeError(f"Strategy registry missing definitions: {sorted(s.value for s in _missing)}")


def get_strategy_info(strategy_type: StrategyType) -> Dict[str, str]:
    """Get information about a strategy."""
    return STRATEGY_REGISTRY.get(strategy_type, {})


def list_strategies() -> List[StrategyType]:
    """List all available strategies."""
    return list(STRATEGY_REGISTRY.keys())


def get_risk_level(strategy_type: StrategyType) -> str:
    """Get risk level for a strategy."""
    info = get_strategy_info(strategy_type)
    return info.get("risk", "unknown")
