const child_process = require('child_process');
const fs = require('fs');

function run(command, args, cwd) {
    // Returns [status stdout, stderr]
    const options = {
        cwd: cwd,
        encoding: 'utf-8',
    };
    const result = child_process.spawnSync(command, args, options);
    return [result.status, result.stdout, result.stderr];
}

module.exports = async ({ context, github, glob }) => {
    const body = context.payload.issue.body;
    let match = body.match(/https?:\/\/[^\s]+/);
    // Ignore github.com URLs
    if (match && match[0].includes('https://github.com')) {
        match = null;
    }
    if (!match) {
        github.rest.issues.createComment({
            issue_number: context.issue.number,
            owner: context.repo.owner,
            repo: context.repo.repo,
            body: '🚫 No URL found in issue body.'
        });
        return;
    }
    const url = match[0];
    // Create directory named after the issue number
    const number = context.issue.number.toString();
    child_process.spawnSync('mkdir', ['-p', number]);
    // Create subdirectories subs, auto, whisper
    child_process.spawnSync('mkdir', ['-p', `${number}/subs`]);
    child_process.spawnSync('mkdir', ['-p', `${number}/auto`]);
    let results = [];

    results.push(run('yt-dlp', ['--all-subs', '--skip-download', '--sub-format', 'ttml/vtt/best', url], `${number}/subs`));
    // Did that create any files?
    const files = child_process.spawnSync('ls', [`${number}/subs`]);
    if (files.stdout.toString().trim() === '') {
        // Use --write-auto-sub
        results.push(run('yt-dlp', ['--write-auto-sub', '--skip-download', '--sub-format', 'ttml/vtt/best', url], `${number}/auto`));
        // Now delete all but the `ru` and `en` files
        const autoFiles = fs.readdirSync(`${number}/auto`);
        autoFiles.forEach(file => {
            if (!file.includes('.ru.') && !file.includes('.en.')) {
                fs.unlinkSync(`${number}/auto/${file}`);
            }
        });
    }
    const comment = results.map(result => {
        return `\`\`\` + ${result[0]}\n${result[1]}\n${result[2]}\`\`\``;
    }).join('\n');
    // Post the output as a comment
    github.rest.issues.createComment({
        issue_number: context.issue.number,
        owner: context.repo.owner,
        repo: context.repo.repo,
        body: comment,
    });
    // Generate a comment with the result from .ttml or .vtt files
    for (const format of ['ttml', 'vtt']) {
        const globber = await glob.create(`${number}/**/*.${format}`);
        const foundFiles = await globber.glob();
        if (foundFiles.length) {
            // Pass it through XXXX-to-json
            let args = [foundFiles[0]];
            let command = null;
            if (format === 'vtt') {
                args.push('--dedupe');
                command = 'webvtt-to-json';
            } else {
                command = 'ttml-to-json';
            }
            const captions = JSON.parse(
                child_process.spawnSync(command, args, {
                    encoding: 'utf-8',
                }
                ).stdout);
            github.rest.issues.createComment({
                issue_number: context.issue.number,
                owner: context.repo.owner,
                repo: context.repo.repo,
                body: '```\n' + captions.map(caption => caption.lines.join('\n')).join('\n') + '\n```',
            });
            break;
        }
    }
    // Close the issue
    github.rest.issues.update({
        issue_number: context.issue.number,
        owner: context.repo.owner,
        repo: context.repo.repo,
        state: 'closed'
    });
}
