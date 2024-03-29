const ytdl       = require('ytdl-core');
const fs         = require('fs');
const path       = require('path');
const os         = require('os');
const uuid       = require('uuid');
const express    = require('express');
const { Router } = require('express');
const bodyParser = require('body-parser');
const cors       = require('cors');

const app = express();
const route = Router();

app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

app.use(cors());
app.use(route);

let downloadPath = './downloads';

route.get('/', (request, response) => {
    response.sendFile(path.join(__dirname, 'home.html'));
});

let downloadInProgress = false;

route.post('/download', (request, response) => {
    const videoUrl = request.body.videoUrl;

    if (downloadInProgress) {
        return response.status(409).send('Download is already in progress');
    }

    downloadInProgress = true;

    ytdl.getInfo(videoUrl).then((info) => {
        const format = ytdl.chooseFormat(info.formats,{filter: 'audioandvideo', quality: 'highest'});
    
        const uniqueId = uuid.v4();
        const outputPath = path.join(downloadPath, `${uniqueId}.mp4`);
        const outputStream = fs.createWriteStream(outputPath);
    
        const downloadVideo = ytdl.downloadFromInfo(info, { format: format });
    
        let downloaded = 0;
    
        downloadVideo.on('progress', (chunkLength, downloadedBytes, totalBytes) => {
            downloaded += chunkLength;
    
            const percent = downloaded / totalBytes * 100;
            // process.stdout.clearLine();
            // process.stdout.cursorTo(0);
            // process.stdout.write(`Downloading... ${percent.toFixed(2)}%`);
        });
    
        downloadVideo.pipe(outputStream);
    
        outputStream.on('open', () => {
            console.log('Started downloading...\n');
        });
    
        outputStream.on('finish', () => {
            console.log(`\nFinished downloading: ${outputPath}\n`);
            downloadInProgress = false;

            response.download(outputPath, `${uniqueId}.mp4`, (err) => {
                if (err) {
                    console.error('Error sending file:', err);
                    response.sendStatus(500);
                } else {
                    console.log('File sent successfully');
                    fs.unlink(outputPath, (unlinkErr) => {
                        if (unlinkErr) {
                            console.error('Error deleting file:', unlinkErr);
                        } else {
                            console.log('File deleted successfully');
                        }
                    });
                }
            });
        });

        
    }).catch((err) => {
        console.error(err);
        response.sendStatus(500);
    });
});

app.listen(3000, () => {
    console.log(`Server is running`);
})
