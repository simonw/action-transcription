const child_process = require('child_process');
const fs = require('fs');

module.exports = ({ context, github }) => {
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
    // Create directory named after the issue number
    const number = context.issue.number.toString();
    child_process.spawnSync('mkdir', ['-p', `${number}/whisper`]);
    // Use yt-dlp to extract the audio
    console.log(child_process.spawnSync('yt-dlp', [
        '-x', url, '--audio-format', 'mp3', '--output', `${number}/whisper/audio.%(ext)s`
    ], {
        encoding: 'utf-8',
    }).stdout);
    console.log(child_process.spawnSync('find', [number], {
        encoding: 'utf-8',
    }).stdout);
    // Run it through whisper
    console.log(child_process.spawnSync('python', [
        'transcribe_audio.py', `${number}/whisper/audio.mp3`, `${number}/whisper/transcription.json`
    ], {
        encoding: 'utf-8',
    }).stderr);
    // Now delete the audio file so we don't check it into the repo
    fs.unlinkSync(`${number}/whisper/audio.mp3`);
    // Load JSON from transcription.json
    const transcription = JSON.parse(fs.readFileSync(`${number}/whisper/transcription.json`));
    let comment = '';
    if (transcription.detected_language) {
        comment += `Language: ${transcription.detected_language}\n\n`;
    }
    if (transcription.transcription) {
        comment += 'Transcription: `' + transcription.transcription + '`\n\n';
    }
    if (transcription.translation) {
        comment += 'Translation: `' + transcription.translation + '`\n\n';
    }
    // Post the output as a comment
    github.rest.issues.createComment({
        issue_number: context.issue.number,
        owner: context.repo.owner,
        repo: context.repo.repo,
        body: comment
    });
    // Close the issue
    github.rest.issues.update({
        issue_number: context.issue.number,
        owner: context.repo.owner,
        repo: context.repo.repo,
        state: 'closed'
    });
}
