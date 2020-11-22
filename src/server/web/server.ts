import { promises as fs } from "fs";
import { createServer as CreateWebServer } from "http";
import * as path from "path";

import { IConfiguration } from "../../interfaces/configuration/configurationFile";
import { Log } from "multi-level-logger";

const PORT = 8080,
    ROOT_PATH = path.join(__dirname, `www`);

interface IResponse {
    content: string;
    contentType: string;
}

class WebServer {
    constructor(private readonly configuration: IConfiguration) {}

    /** Serve files out of www */
    private async staticFiles(requestPath: string): Promise<IResponse> {
        if ((requestPath == `/`))
            requestPath = `/index.html`;

        const pathSegments = requestPath.split(`/`),
            filePath = path.join(ROOT_PATH, ...pathSegments);

        // Try to read the file
        try {
            const fileContents = await fs.readFile(filePath, { encoding: `utf8` });
            let contentType = `application/octet-stream`;

            switch (path.extname(filePath)) {
                case `.html`:
                    contentType = `text/html`;
                    break;
            }

            return {
                content: fileContents,
                contentType
            };
        } catch (err) {
            // Return undefined for any error, triggering a 404 response
            return undefined;
        }
    }

    /** Start listening for requests */
    private async initializeServer() {
        const server = CreateWebServer(async (req, res) => {
            let responseData: IResponse = null;

            if (req.url.search(/^\/data/) == 0) {

            } else
                responseData = await this.staticFiles(req.url);

            if (responseData === undefined) {
                res.writeHead(404);
                res.end();
            } else {
                res.writeHead(200, { [`Content-Type`]: responseData.contentType });
                res.write(responseData.content);
                res.end();
            }
        });

        server.listen({ port: PORT });
    }

    public async Start(): Promise<void> {
        await this.initializeServer();

        Log(`Web server started on port ${PORT}`);
    }
}

export {
    WebServer,
};
