#!/usr/bin/env python3
"""
Calls OpenAI API to generate a PR description from the current branch diff vs develop.
Writes 'claude-description' to $GITHUB_OUTPUT using HEREDOC multiline syntax.
Exits cleanly (empty output) if OPENAI_API_KEY is not set or on any error.
"""
import json
import os
import subprocess
import sys
import urllib.request


def get_git_info(base: str = "origin/develop") -> tuple[str, str, str]:
    def run(cmd: list[str]) -> str:
        return subprocess.run(cmd, capture_output=True, text=True).stdout.strip()

    commits = run(["git", "log", "--oneline", f"{base}..HEAD"]) or "Sem commits encontrados"
    files = run(["git", "diff", "--name-only", f"{base}..HEAD"]) or "Nenhum arquivo modificado"
    diff_stat = run(["git", "diff", "--stat", f"{base}..HEAD"])[:2000]
    return commits, files, diff_stat


def extract_response_text(result: dict) -> str:
    output_text = result.get("output_text")
    if isinstance(output_text, str) and output_text.strip():
        return output_text.strip()

    parts: list[str] = []
    output = result.get("output", [])
    if isinstance(output, list):
        for item in output:
            if not isinstance(item, dict):
                continue
            content = item.get("content", [])
            if not isinstance(content, list):
                continue
            for block in content:
                if not isinstance(block, dict):
                    continue
                if block.get("type") == "output_text":
                    text = block.get("text")
                    if isinstance(text, str) and text.strip():
                        parts.append(text.strip())

    return "\n".join(parts).strip()


def call_gpt(api_key: str, branch: str, commits: str, files: str, diff_stat: str) -> str:
    prompt = (
        "Você é um engenheiro sênior escrevendo uma descrição de PR concisa e clara "
        "em Português (Brasil) para um SaaS de gestão de leads chamado Lead Flow.\n\n"
        f"Branch: {branch}\n"
        f"Commits:\n{commits}\n\n"
        f"Arquivos modificados:\n{files}\n\n"
        f"Resumo do diff:\n{diff_stat}\n\n"
        "Escreva uma breve descrição de PR substituindo EXATAMENTE as linhas abaixo:\n"
        "- Summary of changes: <seus bullet points aqui>\n"
        "- Why this change is needed: <sua frase aqui>\n\n"
        "Regras:\n"
        '- 2 a 4 bullet points em "Summary of changes", um por linha, prefixados com "- "\n'
        '- 1 a 2 frases em "Why this change is needed", na mesma linha após ":"\n'
        "- Seja específico e técnico\n"
        "- Retorne APENAS as duas linhas substituídas, sem texto extra"
    )

    payload = json.dumps({
        "model": "gpt-4.1-mini",
        "input": prompt,
        "max_output_tokens": 500,
    }).encode()

    req = urllib.request.Request(
        "https://api.openai.com/v1/responses",
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "content-type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as response:
        result = json.loads(response.read())
        return extract_response_text(result)


def write_output(value: str) -> None:
    github_output = os.environ.get("GITHUB_OUTPUT", "")
    if not github_output:
        print(f"claude-description={value}")
        return
    with open(github_output, "a") as f:
        f.write(f"claude-description<<CLAUDE_EOF\n{value}\nCLAUDE_EOF\n")


def main() -> None:
    api_key = os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        print("OPENAI_API_KEY não definido — ignorando geração de descrição", file=sys.stderr)
        write_output("")
        return

    branch = os.environ.get("BRANCH_NAME", "unknown")

    try:
        subprocess.run(
            ["git", "fetch", "origin", "develop", "--depth=50"],
            capture_output=True,
            timeout=20,
        )
        commits, files, diff_stat = get_git_info()
        description = call_gpt(api_key, branch, commits, files, diff_stat)
        write_output(description)
        print("Descrição GPT/OpenAI gerada com sucesso")
    except Exception as e:
        print(f"Warning: Falha ao gerar descrição GPT/OpenAI: {e}", file=sys.stderr)
        write_output("")


if __name__ == "__main__":
    main()
