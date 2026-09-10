#!/usr/bin/env python3
import os
import pty
import re
import select
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
PROJECT_NAME = "wizard-test"
PROMPTS = (
    ("Project name:", PROJECT_NAME),
    ("Keep the blog feature?", "n"),
    ("Keep the FAQ feature?", "n"),
    ("Keep the integration catalog?", "n"),
    ("Keep the events feature?", "n"),
    ("Will you host on Cloudflare Workers?", "n"),
)


def wait_for(master: int, output: bytearray, prompt: str, deadline: float) -> None:
    expected = prompt.encode()
    while expected not in output:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise AssertionError(f"timed out waiting for {prompt!r}:\n{output.decode(errors='replace')}")
        readable, _, _ = select.select([master], [], [], remaining)
        if not readable:
            continue
        try:
            chunk = os.read(master, 4096)
        except OSError:
            chunk = b""
        if chunk:
            output.extend(chunk)


def main() -> None:
    fixture_root = Path(tempfile.mkdtemp(prefix="create-stardrive-pty-"))
    try:
        fake_bin = fixture_root / "bin"
        fake_bin.mkdir()
        fake_git = fake_bin / "git"
        fake_git.write_text(
            "#!/bin/sh\n"
            "case \"$*\" in\n"
            "  *ls-remote*) printf 'deadbeef\\trefs/tags/v1.5.9\\n' ;;\n"
            "  *)\n"
            "    for target; do :; done\n"
            "    mkdir -p \"$target/.git\"\n"
            "    printf '{\"name\":\"stardrive\",\"scripts\":{}}\\n' > \"$target/package.json\"\n"
            "    printf 'export default {\\n};\\n' > \"$target/theme.config.ts\"\n"
            "    printf '#package-lock.json\\n' > \"$target/.gitignore\"\n"
            "    ;;\n"
            "esac\n"
        )
        fake_git.chmod(0o755)
        subprocess.run(["node", "build.mjs"], cwd=REPO_ROOT, check=True)

        master, slave = pty.openpty()
        env = os.environ | {
            "PATH": f"{fake_bin}:{os.environ['PATH']}",
            "TERM": "xterm",
            "npm_config_user_agent": "npm/11.17.0 node/v26.4.0 darwin x64",
        }
        process = subprocess.Popen(
            ["node", str(REPO_ROOT / "bin/index.js"), "--version", "1.5.9", "--no-install"],
            cwd=fixture_root,
            env=env,
            stdin=slave,
            stdout=slave,
            stderr=slave,
            close_fds=True,
        )
        os.close(slave)
        output = bytearray()
        deadline = time.monotonic() + 10
        for prompt, answer in PROMPTS:
            wait_for(master, output, prompt, deadline)
            os.write(master, f"{answer}\n".encode())
        while process.poll() is None:
            wait_for(master, output, "All systems go.", deadline)
        try:
            while True:
                chunk = os.read(master, 4096)
                if not chunk:
                    break
                output.extend(chunk)
        except OSError:
            pass
        finally:
            os.close(master)

        rendered = output.decode(errors="replace")
        assert process.returncode == 0, rendered
        for prompt, _ in PROMPTS:
            assert prompt in rendered, rendered
        assert "All systems go." in rendered, rendered
        theme = (fixture_root / PROJECT_NAME / "theme.config.ts").read_text()
        assert re.search(r"droppedFeatures: \['blog', 'faq', 'integrations', 'events', 'cloudflare'\]", theme), theme
        print("Interactive macOS PTY wizard test passed")
    finally:
        shutil.rmtree(fixture_root, ignore_errors=True)


if __name__ == "__main__":
    main()
