
import json, re, sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
from html.parser import HTMLParser

BASE = 'https://halifaxstanfield.ca/flights/'

class TableParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tables = []
        self.table = None
        self.row = None
        self.cell = None

    def handle_starttag(self, tag, attrs):
        if tag == 'table':
            self.table = []
        elif self.table is not None and tag == 'tr':
            self.row = []
        elif self.row is not None and tag in ('td', 'th'):
            self.cell = []

    def handle_data(self, data):
        if self.cell is not None:
            self.cell.append(data)

    def handle_endtag(self, tag):
        if tag in ('td', 'th') and self.cell is not None:
            self.row.append(' '.join(''.join(self.cell).split()))
            self.cell = None
        elif tag == 'tr' and self.row is not None:
            if self.row:
                self.table.append(self.row)
            self.row = None
        elif tag == 'table' and self.table is not None:
            self.tables.append(self.table)
            self.table = None

def collect(direction):
    url = BASE + direction + '/'
    req = Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (compatible; YHZFlightBoard/1.0; public-display)'
    })

    with urlopen(req, timeout=30) as r:
        html = r.read().decode('utf-8', 'replace')

    parser = TableParser()
    parser.feed(html)
    matches = []

    for table in parser.tables:
        for i, row in enumerate(table):
            heads = ' '.join(row).lower()

            if 'flight' in heads and 'expected' in heads and 'status' in heads:
                for values in table[i+1:]:
                    if len(values) < 7:
                        continue

                    carrier, flight, place, expected, actual, gate, status = values[:7]

                    if not re.search(r'\d', flight):
                        continue

                    record = {
                        'carrier': carrier,
                        'flight': flight,
                        'expected': expected,
                        'actual': actual,
                        'gate': re.sub(r'^Gate:\s*', '', gate, flags=re.I),
                        'status': status
                    }

                    record['from' if direction == 'arrivals' else 'destination'] = place
                    matches.append(record)

                break

        if matches:
            break

    if not matches:
        raise RuntimeError(
            f'No recognizable flight table found on {url}; '
            'site markup may have changed. Existing data was not overwritten.'
        )

    return matches

def main():
    arrivals = collect('arrivals')
    departures = collect('departures')

    data = {
        'updated': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
        'airport': 'YHZ',
        'source': 'Halifax Stanfield public flight pages',
        'arrivals': arrivals,
        'departures': departures
    }

    Path('flights.json').write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + '\n',
        encoding='utf-8'
    )

    print(f'Wrote {len(arrivals)} arrivals and {len(departures)} departures')

if __name__ == '__main__':
    main()
