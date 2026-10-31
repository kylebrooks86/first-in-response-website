"""Private read-only FIRE Customer # historical backfill preflight.

Runs ONLY on an owner-held .sql export restored into temporary in-memory
SQLite. No Cloudflare/Stripe calls, migration SQL output, hosted database write
or customer name, contact, UUID, address or email is printed.

This is a rehearsal for review, NOT an approved numbered-identity migration.
"""
import argparse
from datetime import datetime
import json
from pathlib import Path
import re
import sqlite3
import sys

class CustomerHistoryBlocked(ValueError):
    pass

def require(condition, reason):
    if not condition:
        raise CustomerHistoryBlocked(reason)

def parse_date(value):
    require(isinstance(value,str) and value.strip(),'Missing customer creation timestamp')
    # Migration SQL orders the SAVED TEXT timestamps; accepting mixed offsets
    # or precisions could silently assign a different immutable Customer #
    # than this preflight's true chronological sort.
    require(re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z',value) is not None,
            'Customer timestamps must be canonical UTC (Z) before immutable numbering')
    try:
        parsed=datetime.fromisoformat(value.replace('Z','+00:00'))
        require(parsed.tzinfo is not None,'Customer creation timestamp is not timezone-aware')
        return parsed.timestamp()
    except CustomerHistoryBlocked:
        raise
    except (ValueError,OverflowError):
        raise CustomerHistoryBlocked('Invalid customer creation timestamp') from None

def table_columns(db,name):
    return {row[1] for row in db.execute('PRAGMA table_info("'+name+'")')}

def analyze(db):
    columns=table_columns(db,'customers')
    require({'id','created_at'} <= columns, 'Saved customer table is missing required identity fields')
    require(not db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='fire_customer_numbers' LIMIT 1").fetchone(),
            'Permanent Customer # table already exists: reconcile, never reassign')
    columns_to_read=['id','created_at']
    # Inspect contact collisions as a conservative private manual-review gate.
    for column in ('email','phone'):
        if column in columns:
            columns_to_read.append(column)
    rows=db.execute('SELECT '+','.join(columns_to_read)+' FROM customers').fetchall()
    require(len(rows)<=200000,'Unexpected historical customer count')
    customers={};emails=set();phones=set();timestamp_precisions=set()
    for values in rows:
        item=dict(zip(columns_to_read,values))
        identity=item['id']
        require(isinstance(identity,str) and identity.strip() and identity not in customers,
                'Customer identity is missing or duplicated')
        customers[identity]=(parse_date(item['created_at']),item['created_at'])
        matched=re.search(r'\.(\d+)Z$',item['created_at'])
        timestamp_precisions.add(len(matched.group(1)) if matched else 0)
        require(len(timestamp_precisions)<=1,
                'Mixed saved UTC timestamp precisions could renumber historical customers')
        email=item.get('email')
        if isinstance(email,str) and email.strip():
            key=email.strip().casefold()
            require(key not in emails,'Duplicate saved email requires owner identity review')
            emails.add(key)
        phone=item.get('phone')
        if isinstance(phone,str) and phone.strip():
            digits=re.sub(r'\D','',phone)
            if len(digits)==11 and digits.startswith('1'):
                digits=digits[1:]
            if len(digits)==10:
                require(digits not in phones,'Duplicate saved phone requires owner identity review')
                phones.add(digits)
    ordered=sorted(customers,key=lambda identifier:(customers[identifier][0],identifier))
    mapping={identifier:i+1 for i,identifier in enumerate(ordered)}
    return {
        'historicalCustomers':len(ordered),
        'proposedCustomerNumbers':len(mapping),
        'timestampTies':len(ordered)-len({customers[identity][0] for identity in ordered}),
        'historicalNumberAssignmentProposedOnly':True,
        'remoteD1Changed':False,
        'deployedAppChanged':False,
        'mapping':mapping
    }

def rehearse_in_memory(db,plan):
    require(db.execute('PRAGMA database_list').fetchall()[0][2]=='',
            'Customer numbering rehearsal must run only in-memory')
    require(len(plan['mapping'])==plan['historicalCustomers'],
            'Incomplete historical customer-numbering plan')
    db.executescript(Path(__file__).with_name('customer_numbers_v1.sql').read_text(encoding='utf-8'))
    db.execute('PRAGMA foreign_keys=ON')
    require(db.execute('PRAGMA foreign_keys').fetchone()==(1,),
            'Foreign key enforcement unavailable')
    try:
        db.execute('BEGIN')
        for identity,number in sorted(plan['mapping'].items(),key=lambda item:item[1]):
            record=db.execute('SELECT created_at FROM customers WHERE id=?',(identity,)).fetchone()
            require(record is not None and isinstance(record[0],str),
                    'Customer disappeared before numbering rehearsal')
            db.execute('INSERT INTO fire_customer_numbers(customer_number,customer_id,created_at) VALUES(?,?,?)',
                       (number,identity,record[0]))
        count=db.execute('SELECT COUNT(*) FROM fire_customer_numbers').fetchone()[0]
        require(count==plan['historicalCustomers'],'Customer count and saved numbers diverged')
        high=db.execute("SELECT seq FROM sqlite_sequence WHERE name='fire_customer_numbers'").fetchone()
        require(high is not None and high[0]==plan['historicalCustomers'],
                'Autoincrement history does not match the assigned customer count')
        require(db.execute('PRAGMA foreign_key_check').fetchall()==[],
                'Customer-number FK integrity failed')
        require(db.execute('PRAGMA integrity_check').fetchone()==('ok',),
                'Customer-numbering SQLite integrity failed')
        db.commit()
    except:
        db.rollback()
        raise
    return {'inMemoryBackfillRehearsalPassed':True,'hostedMigrationApplied':False}

def read_export(filename):
    file=Path(filename)
    require(file.is_file() and not file.is_symlink() and 0<file.stat().st_size<=100000000,
            'Private export missing, unsafe or too large')
    db=sqlite3.connect(':memory:')
    try:
        db.enable_load_extension(False)
        # Refuse access to attached external databases and output-producing SQL.
        db.set_authorizer(lambda op,a,b,c,d:
            sqlite3.SQLITE_DENY if op in (sqlite3.SQLITE_ATTACH,sqlite3.SQLITE_DETACH)
            else sqlite3.SQLITE_OK)
        try:
            db.executescript(file.read_text(encoding='utf-8-sig'))
        except (sqlite3.Error,UnicodeError):
            raise CustomerHistoryBlocked('Private export could not be restored in memory') from None
        require(db.execute('PRAGMA integrity_check').fetchone()==('ok',),
                'Export integrity check did not pass')
        plan=analyze(db)
        plan.update(rehearse_in_memory(db,plan))
        return plan
    finally:
        db.close()

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--sql-export',required=True,help='Owner-held private SQL export. Never upload.')
    args=parser.parse_args()
    try:
        result=read_export(args.sql_export)
        result.pop('mapping',None)
        print(json.dumps(result,indent=2))
    except (CustomerHistoryBlocked,sqlite3.Error,ValueError,OSError):
        # Do not print SQL content, paths, customer data or sensitive exceptions.
        print('BLOCKED: private Customer # history needs owner review before any migration',file=sys.stderr)
        sys.exit(1)
