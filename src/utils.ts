import { ErrorRequestHandler, RequestHandler } from "express";

export const handleError: (showStackTrace?: boolean) => ErrorRequestHandler =
(showStackTrace = true) => (err, req, res, next) => {
    res.status(err?.status || 500);
    res.json({ error: showStackTrace ? JSON.stringify(err) : "", message: err?.message });
};

export const catch404: () => RequestHandler = () => (req, res, next) => {
    const err = new Error("Not Found");
    (err as any).status = 404;
    next(err);
};
