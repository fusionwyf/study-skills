#!/usr/bin/env python3
"""Shared constants, paths and imports for the Course Kit build toolchain."""

import argparse

import hashlib

import json

import os

import re

import shutil

import subprocess

import sys

import tempfile

import uuid

from html.parser import HTMLParser

from pathlib import Path

# Force UTF-8 stdout/stderr on Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

KIT_VERSION = "2.0.0"

KIT_ROOT = Path(__file__).resolve().parent.parent

# Shared chapter-aware layout rules live with the course scripts (see
# scripts/course_layout.py); lessons/ and records/ may be split per chapter.
sys.path.insert(0, str(KIT_ROOT.parent / "scripts"))

import course_layout

import record_builder

SKILL_ROOT = KIT_ROOT.parent

LAYER_ORDER = ["reset", "tokens", "base", "content", "shell", "learning", "viz", "theme", "course"]

LAYER_HEADER = "@layer reset, tokens, base, content, shell, learning, viz, theme, course;\n\n"

UNIFIED_VENDORS = {
    "hljs": {
        "id": "hljs",
        "version": "11.12.0",
        "js": {
            "cdn": "https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.12.0/build/highlight.min.js",
            "local": "../assets/kit/vendor/hljs/highlight.min.js"
        }
    },
    "katex": {
        "id": "katex",
        "version": "0.16.11",
        "css": {
            "cdn": "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css",
            "local": "../assets/kit/vendor/katex/katex.min.css"
        },
        "js": {
            "cdn": "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js",
            "local": "../assets/kit/vendor/katex/katex.min.js"
        },
        "autoRender": {
            "cdn": "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js",
            "local": "../assets/kit/vendor/katex/auto-render.min.js"
        }
    },
    "mermaid": {
        "id": "mermaid",
        "version": "11.4.1",
        "js": {
            "cdn": "https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js",
            "local": "../assets/kit/vendor/mermaid/mermaid.min.js"
        }
    },
    "plotly": {
        "id": "plotly",
        "version": "4.1.2",
        "js": {
            "cdn": "https://cdn.jsdelivr.net/npm/plotly.js-dist-min@4.1.2/plotly.min.js",
            "local": "../assets/kit/vendor/plotly.js-dist-min/plotly.min.js"
        }
    },
    "plot": {
        "id": "plot",
        "version": "0.6.16",
        "js": {
            "cdn": "https://cdn.jsdelivr.net/combine/npm/d3@7.9.0/dist/d3.min.js,npm/@observablehq/plot@0.6.16/dist/plot.umd.min.js",
            "local": "../assets/kit/vendor/observable-plot/plot.bundle.min.js"
        }
    },
    "jsxgraph": {
        "id": "jsxgraph",
        "version": "1.14.0",
        "css": {
            "cdn": "https://cdn.jsdelivr.net/npm/jsxgraph@1.14.0/distrib/jsxgraph.css",
            "local": "../assets/kit/vendor/jsxgraph/jsxgraph.css"
        },
        "js": {
            "cdn": "https://cdn.jsdelivr.net/npm/jsxgraph@1.14.0/distrib/jsxgraphcore.js",
            "local": "../assets/kit/vendor/jsxgraph/jsxgraphcore.js"
        }
    }
}
