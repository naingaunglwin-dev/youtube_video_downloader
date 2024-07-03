const ytdl       = require('ytdl-core');
const fs         = require('fs');
const path       = require('path');
const express    = require('express');
const { Router } = require('express');
const bodyParser = require('body-parser');
const cors       = require('cors');
const http = require('http');
const socket = require('socket.io');

const app = express();
const route = Router();
const server = http.createServer(app);
const io = socket(server);

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
    const roomId   = request.body.roomId;

    if (downloadInProgress) {
        return response.status(409).send('Download is already in progress');
    }

    downloadInProgress = true;

    ytdl.getInfo(videoUrl).then((info) => {
        const format = ytdl.chooseFormat(info.formats,{filter: 'audioandvideo', quality: 'highest'});

        const outputPath   = path.join(downloadPath, `${info.videoDetails.title.replace(/[/\\?%*:|"<>]/g, '_')}.mp4`);
        const outputStream = fs.createWriteStream(outputPath);

        const downloadVideo = ytdl.downloadFromInfo(info, { format: format });

        let downloaded = 0;

        downloadVideo.on('progress', (chunkLength, downloadedBytes, totalBytes) => {
            // Show download percent in cmd

            // downloaded += chunkLength;
            //
            // const percent = downloaded / totalBytes * 100;
            // process.stdout.clearLine();
            // process.stdout.cursorTo(0);
            // process.stdout.write(`Downloading... ${percent.toFixed(2)}%`);

            downloaded += chunkLength;
            const percent = downloaded / totalBytes * 100;
            io.to(roomId).emit('progress', { percent: percent.toFixed(2) });
        });

        downloadVideo.pipe(outputStream);

        // outputStream.on('open', () => {
        //     console.log('Your video downloading is started.\n');
        // });

        outputStream.on('finish', () => {
            console.log(`\nFinished downloading: ${outputPath}\n`);
            downloadInProgress = false;

            fs.readFile(outputPath, (err, data) => {
                if (err) {
                    console.error('Error reading file:', err);
                    response.sendStatus(500);
                } else {
                    response.setHeader('Content-Type', 'video/mp4');

                    const filename = info.videoDetails.title.replace(/[/\\?%*:|"<>]/g, '_') + '.mp4';
                    const fileData = data.toString('base64');
                    const responseData = { filename, fileData };

                    response.json(responseData);

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

io.on('connection', (socket) => {
    socket.on('joinRoom', ({ roomId }) => {
        socket.join(roomId);
    });
});

server.listen(3000, () => {
    console.log(`Server is running`);
})
