"""Expose lint failures as GitHub annotations, even when raw CI log downloads are unavailable."""
from pathlib import Path
import xml.etree.ElementTree as ET

root = Path.cwd()
reports = root / 'android/app/build/reports'
emitted = False

def escape(text):
    return str(text).replace('%', '%25').replace('\r', '%0D').replace('\n', '%0A')

for report in reports.glob('lint-results*.xml'):
    for issue in ET.parse(report).getroot().findall('issue'):
        if issue.get('severity') not in ('Error', 'Fatal'):
            continue
        location = issue.find('location')
        filename = location.get('file') if location is not None else None
        line = location.get('line', '1') if location is not None else '1'
        try:
            filename = str(Path(filename).relative_to(root)) if filename else 'android'
        except ValueError:
            filename = 'android'
        print(f"::error file={filename},line={line},title=Android lint {escape(issue.get('id'))}::{escape(issue.get('message'))}")
        emitted = True
if not emitted:
    output = reports / 'build-output.log'
    if output.exists():
        tail = '\n'.join(output.read_text(errors='replace').splitlines()[-70:])
        print(f'::error title=Android build::{escape(tail[:10000])}')
