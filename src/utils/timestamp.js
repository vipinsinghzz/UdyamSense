function serverTimestamp() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+05:30`;
}
function toDatabaseTimestamp(timestamp) { return timestamp.slice(0, 19).replace('T', ' '); }
function fromDatabaseTimestamp(timestamp) {
  if (typeof timestamp === 'string') return `${timestamp.replace(' ', 'T')}+05:30`;
  return serverTimestamp();
}
module.exports = { serverTimestamp, toDatabaseTimestamp, fromDatabaseTimestamp };
