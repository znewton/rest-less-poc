import express, { RequestHandler } from "express";
import cors from "cors";
import { catch404, handleError } from "./utils";
import formidable from "formidable";
import { IncomingMessage } from "http";

const app = express();
const port = 3000;

app.use(cors({exposedHeaders: "*"}));

interface RestLessTranslationOptions {
    /**
     * Express' Request.get() only retrieves lowercase header keys.
     * Set this to true if headers are being retrieved via `req.get()`.
     * Default: false
     */
    lowercaseHeaders: boolean;
}

class RestLessServer {
    private static decodeHeader(header: string, opts?: Partial<RestLessTranslationOptions>): { name: string, value: string } {
        const [name,value] = header.split(/: (.+)/);
        if (opts.lowercaseHeaders === true) {
            return {
                name: name.toLowerCase(),
                value,
            }
        }
        return { name, value };
    }
    public static async translate(req: IncomingMessage & { body?: any }, opts?: Partial<RestLessTranslationOptions>): Promise<void> {
        if (req.method.toLowerCase() !== "post" || !req.headers["content-type"]?.includes("multipart/form-data")) {
            return;
        }
        const form = formidable({multiples: true});
     
        return new Promise<void>((resolve, reject) => {
            form.parse(req, (err, fields) => {
                if (err) {
                    reject(err);
                    return;
                }
                // Parse and override HTTP Method
                const methodOverride = fields["method"] as string;
                req.method = methodOverride;
                // Parse and add HTTP Headers
                const headerField = fields["header"];
                if (headerField instanceof Array) {
                    headerField.forEach((header) => {
                        const { name, value } = RestLessServer.decodeHeader(header, opts);
                        req.headers[name] = value;
                    });
                } else if (typeof headerField === "string") {
                    const { name, value } = RestLessServer.decodeHeader(headerField, opts);
                    req.headers[name] = value;
                }
                // Parse and replace request body
                const bodyField = fields["body"]
                if (bodyField) {
                    req.body = bodyField;
                }
                resolve();
                return;
            });
        });
    }
}

const restlessMiddleware: () => RequestHandler = () => async (req, res, next) => {
    await RestLessServer.translate(req, { lowercaseHeaders: true });
    next();
}

// const simplePostMiddleware: () => RequestHandler = () => (req, res, next) => {
//     if (req.method !== "POST" || !req.get("Content-Type")?.includes("multipart/form-data")) {
//         console.log("Skipping post middleware")
//         next();
//         return;
//     }

//     const form = formidable();
 
//     form.parse(req, (err, fields, files) => {
//         if (err) {
//             console.error(err);
//         }
//         console.log({fields, files})
//         console.log(req.headers);
//         next();
//     });
// }
app.use(restlessMiddleware());

const debugMiddleware: () => RequestHandler = () => (req, res, next) => {
    console.log({
        headers: req.headers,
        query: req.query,
        body: req.body,
    })
    next();
};
app.use(debugMiddleware());

const authMiddleware: () => RequestHandler = () => (req, res, next) => {
    if (req.get("Authorization") !== "Bearer 123456abcdef") {
        console.log(`Rejecting Auth Header: ${req.get("Authorization")}`)
        res.sendStatus(403);
        return;
    }
    next();
}
app.use(authMiddleware());

app.get("/resource/:id", (req, res) => {
    res.setHeader("Cache-Control", "public, max-age=5")
    res.status(200).json({
        id: req.params.id,
        query: req.query,
        content: "Hello, World",
    });
});

app.use(catch404());
app.use(handleError(app.get("env") === "development"));

app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`)
});
