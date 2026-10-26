"""Observe the pinned Hermes queue in isolation, without models or real sends.

The package harness skips cron/__init__.py so no scheduler or worker is started.
Original queue/SQLite/dependency modules are not modified. Gateway liveness,
job-ledger write-back and provider/platform integrations are outside this probe.
"""
import argparse
import datetime
import hashlib
import json
import os
import platform
import subprocess
import sys
import tempfile
import types
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
COMMIT = 'bf0203a794a07aac3ff764972ab9087baa4e4f4e'
FILES = [
    'hermes_constants.py', 'hermes_time.py', 'hermes_state_wal.py', 'hermes_state_errors.py',
    'agent/__init__.py', 'agent/jiter_preload.py', 'agent/secret_scope.py',
    'agent/redact.py', 'agent/file_safety.py',
    'hermes_cli/__init__.py', 'hermes_cli/sqlite_util.py', 'hermes_cli/sqlite_runtime.py',
    'hermes_cli/observability/__init__.py',
    'hermes_cli/observability/shared_metrics_gateway.py',
    'cron/constants.py', 'cron/executions.py',
    'cron/delivery_queue.py', 'cron/delivery_outcome.py',
]


def load_queue(source, database, home):
    os.environ['HERMES_HOME'] = str(home)
    os.environ['HERMES_TIMEZONE'] = 'UTC'
    sys.path.insert(0, str(source))
    # An explicit namespace avoids launching the scheduler from cron/__init__.
    package = types.ModuleType('cron')
    package.__path__ = [str(source / 'cron')]
    sys.modules['cron'] = package
    import cron.delivery_queue as queue
    queue.DELIVERY_DB = database
    return queue


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source-dir', type=Path, default=ROOT / '.cache' / 'delivery-observation-source')
    parser.add_argument('--output', type=Path, default=ROOT / '.cache' / 'delivery-observation.json')
    parser.add_argument('--claim-only', type=Path, help=argparse.SUPPRESS)
    args = parser.parse_args()
    args.source_dir = args.source_dir.resolve()
    args.source_dir.mkdir(parents=True, exist_ok=True)
    lock_path = ROOT / 'examples' / 'news-brief' / 'delivery-source-lock.json'
    locked = json.loads(lock_path.read_text(encoding='utf-8')) if lock_path.exists() else None
    digests = []
    for path in FILES:
        local = args.source_dir / path
        local.parent.mkdir(parents=True, exist_ok=True)
        if not local.exists():
            with urllib.request.urlopen(f'https://raw.githubusercontent.com/NousResearch/hermes-agent/{COMMIT}/{path}', timeout=30) as response:
                local.write_bytes(response.read())
        digest = hashlib.sha256(local.read_bytes()).hexdigest()
        if locked:
            expected = next(item['sha256'] for item in locked['files'] if item['path'] == path)
            if digest != expected:
                raise RuntimeError(f'Pinned source mismatch: {path}; refusing modified code')
        digests.append({'path': path, 'sha256': digest})
    if args.claim_only:
        queue = load_queue(args.source_dir, args.claim_only, args.claim_only.parent)
        row = queue.claim_next()
        assert row and row['execution_id'] == 'brief-observation'
        # Return normally after claiming, without any transport call or outcome write.
        print(json.dumps({'claimed': True, 'externalSends': 0}))
        return
    with tempfile.TemporaryDirectory(prefix='hello-hermes-delivery-') as temporary:
        home = Path(temporary)
        database = home / 'deliveries.db'
        queue = load_queue(args.source_dir, database, home)
        draft = '教学草稿：两件事件，图片暂不支持。'
        first = queue.enqueue('brief-observation', {}, draft)
        duplicate = queue.enqueue('brief-observation', {}, '重复请求不应覆盖首次内容')
        assert first['status'] == duplicate['status'] == 'pending'
        assert duplicate['content'] == draft
        pending_wait = queue.enqueue_and_wait('brief-observation', {}, draft, timeout=0)
        pending_state = queue.get_status('brief-observation')['status']
        assert pending_wait is None and pending_state == 'pending'
        child = subprocess.run([
            sys.executable, str(Path(__file__).resolve()),
            '--source-dir', str(args.source_dir), '--claim-only', str(database),
        ], check=True, capture_output=True, text=True, encoding='utf-8')
        assert json.loads(child.stdout)['claimed']
        claimed_state = queue.get_status('brief-observation')['status']
        assert claimed_state == 'delivering'
        # Zero wait is an injected test budget, not the normal Hermes default.
        uncertain_error = queue.enqueue_and_wait('brief-observation', {}, draft, timeout=0)
        uncertain_state = queue.get_status('brief-observation')['status']
        repeated = queue.enqueue('brief-observation', {}, draft)['status']
        assert uncertain_state == repeated == 'unknown' and uncertain_error
        assert queue.claim_next() is None
        local_callbacks = []

        def local_send(_job, content, _failure):
            local_callbacks.append(content)
            return None  # Local receipt only; no network adapter exists in this harness.

        queue.enqueue('fresh-observation', {}, draft)
        processed = queue.drain(local_send)
        finished = queue.get_status('fresh-observation')
        assert processed == 1 and finished['status'] == 'delivered'
        assert finished['content'] == '' and len(local_callbacks) == 1
        queue.enqueue('failed-observation', {}, draft)
        assert queue.drain(lambda *_: 'teaching transport refused') == 1
        failed = queue.get_status('failed-observation')
        assert failed['status'] == 'failed'
    report = {
        'schemaVersion': 1, 'kind': 'controlled-official-module-execution',
        'recordedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'upstream': {'repository': 'NousResearch/hermes-agent', 'tag': 'v0.22.5', 'commit': COMMIT, 'files': digests},
        'python': platform.python_version(), 'modelCalls': 0, 'externalSends': 0,
        'requestOrigin': 'fixed driver and local callback, not model decisions',
        'scope': 'Unmodified cron delivery queue with SQLite in a temporary directory; explicit package harness skips scheduler startup.',
        'steps': [
            {'action': 'enqueue same execution twice', 'status': duplicate['status'], 'firstContentPreserved': True},
            {'action': 'zero wait while never claimed', 'status': pending_state, 'error': pending_wait},
            {'action': 'child claims and exits without send or outcome write', 'status': claimed_state, 'childExitCode': child.returncode},
            {'action': 'zero wait after claim', 'status': uncertain_state, 'error': uncertain_error},
            {'action': 'enqueue same execution after uncertainty', 'status': repeated, 'claimable': False},
            {'action': 'new execution through local success callback', 'status': finished['status'], 'localCallbacks': len(local_callbacks), 'terminalContentPruned': finished['content'] == ''},
            {'action': 'new execution through local refused callback', 'status': failed['status'], 'error': failed['error']},
        ],
        'limitations': [
            'No model, scheduler loop, real gateway or platform transport was started.',
            'The child deliberately exits before sending; the queue has no evidence of that fact and treats the claimed outcome as uncertain.',
            'timeout=0 is fault injection, not a documented default.',
            'Dead-owner liveness recovery and job/execution-ledger write-back were not exercised; jobs have no production job id.',
            'A local callback returning success is not proof of external message delivery or human receipt.',
        ],
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf-8', newline='\n')
    print(json.dumps({'output': str(args.output), 'states': [s['status'] for s in report['steps']], 'modelCalls': 0, 'externalSends': 0}))


if __name__ == '__main__':
    main()
