#!/usr/bin/env python3
"""
Encrypt a file with AES-256-CTR using a key derived via PBKDF2-SHA256.
Output format: salt(16) + counter(16) + ciphertext

AES-CTR is a stream cipher: output equals input length (no padding, no auth tag).
The browser can decrypt in 64 KB chunks with ~192 KB peak RAM.

Usage:
  python3 encrypt.py <passphrase> [input.mp4] [output.enc]
"""
import sys, os
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

SALT       = b'cirkeltrainsalt!'  # 16 bytes, fixed — not secret
ITERATIONS = 100_000
CHUNK_SIZE = 64 * 1024            # 64 KB

def encrypt(passphrase: str, src: str, dst: str):
    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=SALT, iterations=ITERATIONS)
    key = kdf.derive(passphrase.encode())

    counter = os.urandom(16)  # initial AES-CTR counter block
    cipher  = Cipher(algorithms.AES(key), modes.CTR(counter))
    enc     = cipher.encryptor()

    total_in = os.path.getsize(src)

    with open(src, 'rb') as f_in, open(dst, 'wb') as f_out:
        f_out.write(SALT + counter)
        while chunk := f_in.read(CHUNK_SIZE):
            f_out.write(enc.update(chunk))
        f_out.write(enc.finalize())

    total_out = 16 + 16 + total_in  # salt + counter + ciphertext (same size as plaintext)
    print(f'Encrypted {total_in:,} → {total_out:,} bytes  →  {dst}')

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    phrase = sys.argv[1]
    src    = sys.argv[2] if len(sys.argv) > 2 else 'udstraek.mp4'
    dst    = sys.argv[3] if len(sys.argv) > 3 else src.rsplit('.', 1)[0] + '.enc'
    encrypt(phrase, src, dst)
