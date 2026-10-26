"""Execute the pinned Hermes ToolRegistry synchronously; no model or external action.

Only stdlib is required. Full Hermes entry points, provider calls, plugins and async
dispatch are outside this controlled observation. Source modules remain unmodified.
"""
import argparse
import datetime
import hashlib
import importlib.util
import json
import os
import platform
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
COMMIT = 'bf0203a794a07aac3ff764972ab9087baa4e4f4e'


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source-dir', type=Path, default=ROOT / '.cache' / 'registry-observation-source')
    parser.add_argument('--output', type=Path, default=ROOT / '.cache' / 'registry-observation.json')
    args = parser.parse_args()
    args.source_dir.mkdir(parents=True, exist_ok=True)
    sources = []
    lock_path = ROOT / 'examples' / 'news-brief' / 'registry-source-lock.json'
    locked = json.loads(lock_path.read_text(encoding='utf-8')) if lock_path.exists() else None
    for path in ['hermes_constants.py', 'agent/__init__.py', 'agent/jiter_preload.py', 'agent/secret_scope.py', 'tools/registry.py']:
        local = args.source_dir / path
        local.parent.mkdir(parents=True, exist_ok=True)
        if not local.exists():
            cached = args.source_dir / path.replace('/', '--')
            if cached.exists():
                local.write_bytes(cached.read_bytes())
            else:
                url = f'https://raw.githubusercontent.com/NousResearch/hermes-agent/{COMMIT}/{path}'
                with urllib.request.urlopen(url, timeout=30) as response:
                    local.write_bytes(response.read())
        digest = hashlib.sha256(local.read_bytes()).hexdigest()
        if locked:
            expected = next(item['sha256'] for item in locked['files'] if item['path'] == path)
            if digest != expected:
                raise RuntimeError(f'Pinned source mismatch: {path}; refusing modified code')
        sources.append({'path': path, 'sha256': digest})
    # Scope is confined to this observation; no use of an operator's Hermes home.
    os.environ['HERMES_HOME'] = str(ROOT / '.cache' / 'registry-observation-home')
    load_module('hermes_constants', args.source_dir / 'hermes_constants.py')
    load_module('agent', args.source_dir / 'agent/__init__.py')
    load_module('agent.secret_scope', args.source_dir / 'agent/secret_scope.py')
    module = load_module('_hello_hermes_observed_registry', args.source_dir / 'tools/registry.py')
    registry = module.ToolRegistry()
    materials = json.loads((ROOT / 'examples' / 'news-brief' / 'materials.json').read_text(encoding='utf-8'))
    calls = []

    def read_material(arguments):
        calls.append({'tool': 'read_material', 'arguments': arguments})
        selected = next(item for item in materials['items'] if item['id'] == arguments['id'])
        return json.dumps(selected, ensure_ascii=False)

    def send_brief(arguments):
        calls.append({'tool': 'send_brief', 'arguments': arguments})
        return json.dumps({'sent': True})

    schema = {'description': '读取固定教学材料。', 'parameters': {'type': 'object', 'properties': {'id': {'type': 'string'}}, 'required': ['id']}}
    registry.register(name='read_material', toolset='lesson', schema=schema, handler=read_material, check_fn=lambda: True)
    registry.register(name='send_brief', toolset='delivery', schema={'description': '发送简报。', 'parameters': {'type': 'object'}}, handler=send_brief, check_fn=lambda: False)
    visible = registry.get_definitions({'read_material', 'send_brief'}, quiet=True)
    success = json.loads(registry.dispatch('read_material', {'id': 'A'}))
    unknown = json.loads(registry.dispatch('not_registered', {}))
    invalid = json.loads(registry.dispatch('read_material', {}))
    report = {
        'schemaVersion': 1, 'kind': 'controlled-official-module-execution',
        'recordedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'upstream': {'repository': 'NousResearch/hermes-agent', 'tag': 'v0.22.5', 'commit': COMMIT, 'files': sources},
        'python': platform.python_version(), 'modelCalls': 0,
        'requestOrigin': 'fixed test driver, not a model decision',
        'materialNature': materials['nature'],
        'scope': 'Unmodified ToolRegistry and hermes_constants; synchronous dispatch only.',
        'registered': registry.get_all_tool_names(),
        'visible': [entry['function']['name'] for entry in visible],
        'steps': [
            {'request': {'name': 'read_material', 'arguments': {'id': 'A'}}, 'result': success},
            {'request': {'name': 'not_registered', 'arguments': {}}, 'result': unknown},
            {'request': {'name': 'read_material', 'arguments': {}}, 'result': invalid},
        ],
        'handlerCalls': calls,
        'limitations': ['No end-to-end Hermes run or model decision was tested.', 'The unavailable tool was omitted from discovery; it was not called to prove an authorization block.', 'No network, messaging delivery, plugin override or asynchronous path was tested.'],
    }
    assert report['visible'] == ['read_material']
    assert success['id'] == 'A' and 'error' in unknown and 'error' in invalid
    assert not any(call['tool'] == 'send_brief' for call in calls)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
    print(json.dumps({'output': str(args.output), 'visible': report['visible'], 'modelCalls': 0}, ensure_ascii=False))


if __name__ == '__main__':
    main()
