"""Thin open client for browser-execution-runtime daemon.

No API key required. Works with any agent/script.
"""

from __future__ import annotations

import json
from typing import Any, Optional
from urllib import error, request


class BrowserRuntimeClient:
    def __init__(self, base_url: str = "http://127.0.0.1:8787", timeout: float = 120.0):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    def health(self) -> dict[str, Any]:
        return self._request("GET", "/health")

    def status(self) -> dict[str, Any]:
        return self._request("GET", "/status")

    def observe(self) -> dict[str, Any]:
        return self._request("GET", "/observe")

    def tabs(self) -> dict[str, Any]:
        return self._request("GET", "/tabs")

    def plugins(self) -> dict[str, Any]:
        return self._request("GET", "/plugins")

    def attach(
        self,
        *,
        start_url: Optional[str] = None,
        cdp_url: Optional[str] = None,
        user_data_dir: Optional[str] = None,
        profile: Optional[str] = None,
        headless: Optional[bool] = None,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {}
        if start_url is not None:
            body["startUrl"] = start_url
        if cdp_url is not None:
            body["cdpUrl"] = cdp_url
        if user_data_dir is not None:
            body["userDataDir"] = user_data_dir
        if profile is not None:
            body["profile"] = profile
        if headless is not None:
            body["headless"] = headless
        return self._request("POST", "/attach", body)

    def execute(self, intent: str) -> dict[str, Any]:
        return self._request("POST", "/execute", {"intent": intent})

    def run(self, plan: dict[str, Any], resume_from_step: Optional[int] = None) -> dict[str, Any]:
        body: dict[str, Any] = {"plan": plan}
        if resume_from_step is not None:
            body["resumeFromStep"] = resume_from_step
        return self._request("POST", "/run", body)

    def resume(self) -> dict[str, Any]:
        return self._request("POST", "/resume", {})

    def call_tool(self, name: str, arguments: Optional[dict[str, Any]] = None) -> dict[str, Any]:
        """Map common tool names to daemon endpoints for agent wrappers."""
        args = arguments or {}
        if name == "browser_attach":
            return self.attach(
                start_url=args.get("startUrl"),
                cdp_url=args.get("cdpUrl"),
                user_data_dir=args.get("userDataDir"),
                profile=args.get("profile"),
                headless=args.get("headless"),
            )
        if name == "browser_execute":
            return self.execute(str(args["intent"]))
        if name == "browser_run_plan":
            return self.run(args["plan"], args.get("resumeFromStep"))
        if name == "browser_observe":
            return self.observe()
        if name == "browser_status":
            return self.status()
        if name == "browser_tabs":
            return self.tabs()
        if name == "browser_resume":
            return self.resume()
        raise ValueError(f"Unknown tool: {name}")

    def _request(self, method: str, path: str, body: Optional[dict[str, Any]] = None) -> dict[str, Any]:
        data = None if body is None else json.dumps(body).encode("utf-8")
        req = request.Request(
            f"{self.base_url}{path}",
            data=data,
            method=method,
            headers={"content-type": "application/json"} if body is not None else {},
        )
        try:
            with request.urlopen(req, timeout=self.timeout) as res:
                return json.loads(res.read().decode("utf-8"))
        except error.HTTPError as exc:
            payload = exc.read().decode("utf-8")
            try:
                parsed = json.loads(payload)
                message = parsed.get("error", payload)
            except Exception:
                message = payload
            raise RuntimeError(f"HTTP {exc.code}: {message}") from exc
