const child_process = require('child_process');

module.exports = (context) => {
    // yt-dlp 'https://www.youtube.com/watch?v=...' --skip-download --write-info-json
    const body = context.payload.issue.body;
    let match = body.match(/https?:\/\/[^\s]+/);
    // Ignore github.com URLs
    if (match && match[0].includes('https://github.com')) {
        match = null;
    }
    if (!match) {
        return;
    }
    const url = match[0];
    const number = context.issue.number.toString();
    child_process.spawnSync('mkdir', ['-p', `${number}/metadata-temp`]);
    child_process.spawnSync('mkdir', ['-p', `${number}/metadata`]);
    child_process.spawnSync('yt-dlp', [url, '--skip-download', '--write-info-json'], {
        cwd: `${number}/metadata-temp`
    });
    // Rename to info.json
    child_process.exec(`cat ${number}/metadata-temp/*.json | jq 'del(.automatic_captions)' -c > ${number}/metadata/info.json`);
    child_process.exec(`rm ${number}/metadata-temp/*.json`);
}
