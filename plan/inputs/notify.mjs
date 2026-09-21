// @ts-check
/**
 * Notifications for the run job. Never throw: a failed notification must not
 * fail the run (diff.md is always on disk regardless).
 *
 *  - Discord: POST to DISCORD_WEBHOOK_PLAN (from .env.local) when set.
 *  - Email:   Python + smtplib with the household SMTP config used by the
 *             send-email skill (~/.skills/skills/amazon-delivery-performance/smtp_config.json),
 *             sent only on RED / failure, or with { always: true }.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const SMTP_CONFIG = path.join(os.homedir(), '.skills', 'skills', 'amazon-delivery-performance', 'smtp_config.json');

/** @param {string} text @param {(m: string) => void} [log] */
export async function notifyDiscord(text, log = console.log) {
  const url = process.env.DISCORD_WEBHOOK_PLAN;
  if (!url) { log('  discord: DISCORD_WEBHOOK_PLAN not set — skipped'); return false; }
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: text.slice(0, 1900) }) });
    log(`  discord: ${res.ok ? 'sent' : 'HTTP ' + res.status}`);
    return res.ok;
  } catch (e) { log(`  discord: failed (${/** @type {Error} */ (e).message})`); return false; }
}

/** Read the shared SMTP config with tolerant key names. */
export function readSmtpConfig() {
  if (!fs.existsSync(SMTP_CONFIG)) return null;
  const c = JSON.parse(fs.readFileSync(SMTP_CONFIG, 'utf8'));
  const pick = (/** @type {string[]} */ keys) => keys.map((k) => c[k]).find((v) => v !== undefined && v !== '');
  return {
    host: pick(['host', 'smtp_host', 'server', 'smtp_server']) ?? 'smtp.gmail.com',
    port: Number(pick(['port', 'smtp_port']) ?? 465),
    user: pick(['sender', 'from', 'user', 'username', 'email', 'sender_email']),
    password: pick(['password', 'app_password', 'smtp_password', 'sender_password']),
    to: pick(['to', 'recipient', 'default_recipient', 'default_to']) ?? pick(['sender', 'from', 'user', 'username', 'email', 'sender_email']),
  };
}

/** @param {{ subject: string, html: string, attachments?: string[] }} msg @param {(m: string) => void} [log] */
export function notifyEmail(msg, log = console.log) {
  const cfg = readSmtpConfig();
  if (!cfg || !cfg.user || !cfg.password) { log('  email: SMTP config not found — skipped'); return false; }
  const py = ['py', 'python', 'python3'].find((cmd) => spawnSync(cmd, ['--version'], { encoding: 'utf8' }).status === 0);
  if (!py) { log('  email: no Python available — skipped'); return false; }
  const script = `
import json, smtplib, ssl, sys
from email.message import EmailMessage
from pathlib import Path
m = json.load(sys.stdin)
msg = EmailMessage(); msg['Subject'] = m['subject']; msg['From'] = m['user']; msg['To'] = m['to']
msg.set_content('See the HTML version.'); msg.add_alternative(m['html'], subtype='html')
for p in m.get('attachments', []):
    data = Path(p).read_bytes(); msg.add_attachment(data, maintype='application', subtype='octet-stream', filename=Path(p).name)
if int(m['port']) == 465:
    s = smtplib.SMTP_SSL(m['host'], int(m['port']), context=ssl.create_default_context())
else:
    s = smtplib.SMTP(m['host'], int(m['port'])); s.starttls(context=ssl.create_default_context())
s.login(m['user'], m['password']); s.send_message(msg); s.quit(); print('sent')
`;
  const r = spawnSync(py, py === 'py' ? ['-3', '-c', script] : ['-c', script], { input: JSON.stringify({ ...cfg, ...msg }), encoding: 'utf8' });
  if (r.status === 0) { log(`  email: sent to ${cfg.to}`); return true; }
  log(`  email: failed (${(r.stderr || r.stdout || '').trim().split('\n').pop()})`);
  return false;
}
