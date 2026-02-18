#!/usr/bin/env python3
"""SSH to Termux and run command in Debian proot"""

import sys
import pexpect

HOST = "192.168.1.3"
PORT = "8022"
USER = "root"
PASS = "ashish 101"

command = sys.argv[1] if len(sys.argv) > 1 else "ls -la"

# SSH into Termux, then run proot-distro login debian with the command
full_command = f'ssh -p {PORT} -o StrictHostKeyChecking=no {USER}@{HOST}'

child = pexpect.spawn(full_command, encoding='utf-8')
child.logfile_read = sys.stdout

try:
    # Wait for Termux password prompt
    child.expect('password:', timeout=10)
    child.sendline(PASS)
    
    # Wait for shell prompt
    child.expect(['#', '$'], timeout=10)
    
    # Run proot-distro login debian with the command
    child.sendline(f'proot-distro login debian -- "{command}"')
    
    # Wait for command to complete
    child.expect(['#', '$'], timeout=60)
    
    # Exit
    child.sendline('exit')
    child.expect(pexpect.EOF, timeout=10)
except pexpect.EOF:
    pass
except pexpect.TIMEOUT:
    print("Timeout")
    sys.exit(1)

sys.exit(child.exitstatus or 0)