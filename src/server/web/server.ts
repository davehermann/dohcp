import { promises as fs } from "fs";
import { createServer as CreateWebServer, get as HttpGet } from "http";
import * as path from "path";

import { IConfiguration } from "../../interfaces/configuration/configurationFile";
import { Log, Trace } from "multi-level-logger";

const PORT = 8080,
    ROOT_PATH = path.join(__dirname, `www`),
    MAXIMUM_STATIC_CACHE_SECONDS = 300;

interface IResponse {
    content: any;
    contentType: string;
}

class WebServer {
    constructor(private readonly configuration: IConfiguration) {}

    private staticCache: Map<string, string> = new Map();

    private async loadStaticFile(filePath: string, fileEncoding: BufferEncoding): Promise<string> {
        if (this.staticCache.has(filePath))
            return this.staticCache.get(filePath);

        const fileContents = await fs.readFile(filePath, { encoding: fileEncoding });
        if (this.configuration.web.staticCache) {
            Trace(`Web Status Server caching ${filePath}`);
            this.staticCache.set(filePath, fileContents);

            // Expire the cached files
            setTimeout(() => {
                this.staticCache.delete(filePath);
                Trace(`${filePath} removed from Web Status Server cache`);
            }, MAXIMUM_STATIC_CACHE_SECONDS * 1000);
        }

        return fileContents;
    }

    /** Serve files out of www */
    private async staticFiles(requestPath: string): Promise<IResponse> {
        if ((requestPath == `/`))
            requestPath = `/index.html`;

        const pathSegments = requestPath.split(`/`),
            filePath = path.join(ROOT_PATH, ...pathSegments);

        // Try to read the file
        try {
            let contentType = `application/octet-stream`,
                fileEncoding: BufferEncoding = `utf8`;

            switch (path.extname(filePath)) {
                case `.css`:
                    contentType = `text/css`;
                    break;

                case `.html`:
                    contentType = `text/html`;
                    break;

                case `.js`:
                    contentType = `text/javascript`;
                    break;

                case `.png`:
                    contentType = `image/png`;
                    fileEncoding = `binary`;
                    break;
            }

            const fileContents = await this.loadStaticFile(filePath, fileEncoding);

            return {
                content: fileContents,
                contentType
            };
        } catch (err) {
            // Return undefined for any error, triggering a 404 response
            return undefined;
        }
    }

    private async dataSource(requestPath: string): Promise<IResponse> {
        const response: IResponse = await new Promise(resolve => {
            HttpGet(
                {
                    host: this.configuration.dataServiceHost,
                    port: this.configuration.dataServicePort,
                    path: requestPath.replace(/^\/data/, ``),
                },
                res => {
                    let data = ``;
                    res.on(`data`, (chunk) => {
                        data += chunk;
                    });

                    res.on(`end`, () => {
                        resolve({
                            content: data,
                            contentType: res.headers[`content-type`],
                        });
                    });
                }
            );
        });

        return response;
    }

    /** Start listening for requests */
    private async initializeServer() {
        const server = CreateWebServer(async (req, res) => {
            let responseData: IResponse = null;

            if (req.url.search(/^\/data/) == 0) {
                // Remove the /data, and proxy to the control server
                responseData = await this.dataSource(req.url);
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
