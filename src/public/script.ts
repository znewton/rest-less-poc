interface RestLessRequestData {
    url: URL | string;
    method: "POST" | "GET" | "HEAD" | "DELETE" | "PUT";
    headers?: Record<string, string>;
    query?: string[][] | Record<string, string> | string | URLSearchParams;
    body?: any;
}

const isBrowser = new Function("try {return this===window;}catch(e){ return false;}");
const isNode = new Function("try {return this===global;}catch(e){return false;}");

class RestLessClient {
    private static CACHE_NAME = "RESTLESS_CACHE";
    private static encodeHeader(headerKey: string, headerValue: string): string {
        return `${headerKey}: ${headerValue}`;
    }
    private static getResponseExpiration(res: Response): Date | false | undefined {
        const cacheControlHeader = res.headers.get("cache-control");
        console.log({cacheControlHeader})
        if (cacheControlHeader && cacheControlHeader.includes("no-store")) {
            // response should not be cached if Cache-Control: no-store
            return false;
        }
        const dateHeader = res.headers.get("date");
        console.log({ dateHeader})
        if (cacheControlHeader && dateHeader) {
            const resMaxAgeSecondsMatch = /.*max-age=([0-9]+)/.exec(cacheControlHeader);
            console.log({resMaxAgeSecondsMatch})
            if (!resMaxAgeSecondsMatch || !resMaxAgeSecondsMatch.length) {
                // response does not specify max-age
                return;
            }
            const resMaxAgeSeconds = Number.parseInt(resMaxAgeSecondsMatch[1]);
            const responseExpirationDate = new Date(dateHeader);
            responseExpirationDate.setSeconds(responseExpirationDate.getSeconds() + resMaxAgeSeconds)
            return responseExpirationDate;
        } else {
            // check expires header only if no cache-control header
            const expiresHeader = res.headers.get("expires");
            if (expiresHeader) {
                return new Date(expiresHeader);
            }
        }
        // response does not specify a cache expiration
    }
    private static async setCachedResponse(url: string, response: Response): Promise<void> {
        if (RestLessClient.getResponseExpiration(response) !== false) {
            const resClone = response.clone();
            const cache = await caches.open(RestLessClient.CACHE_NAME);
            cache.put(url, resClone);
        }
    }
    private static async pruneCachedResponse(url: string, response: Response): Promise<void> {
        const cache = await caches.open(RestLessClient.CACHE_NAME);
        const responseExpiration = RestLessClient.getResponseExpiration(response);
        console.log("Response Expiration:", responseExpiration)
        if (responseExpiration < new Date()) {
            console.log("Pruning cached response", response)
            cache.delete(url);
        }
    }
    private static async getCachedResponse(url: string): Promise<Response | undefined> {
        if (isBrowser()) {
            const cache = await caches.open(RestLessClient.CACHE_NAME);
            const cachedResponse: Response | undefined = await cache.match(url);
            if (cachedResponse !== undefined) {
                console.log("Have cached response", cachedResponse);
                RestLessClient.pruneCachedResponse(url, cachedResponse);
                return cachedResponse;
            }
        }
        return;
    }
    public static async request(reqInfo: RestLessRequestData): Promise<Response> {
        // Build URL
        const url = new URL(reqInfo.url.toString());
        const searchParams = new URLSearchParams(reqInfo.query);
        searchParams.forEach((value, key) => {
            url.searchParams.append(key, value);
        });
        // Check Cache
        const cachedResponse = await RestLessClient.getCachedResponse(url.toString());
        if (cachedResponse) {
            console.log("Returning cached response", cachedResponse);
            return cachedResponse;
        }
        // Build multipart/form-data body
        const body = new FormData();
        body.append("method", reqInfo.method);
        if (reqInfo.headers) {
            for (const [headerKey, headerValue] of Object.entries(reqInfo.headers)) {
                body.append("header", RestLessClient.encodeHeader(headerKey, headerValue));
            }
        }
        if (reqInfo.body && ["POST", "PUT"].includes(reqInfo.method)) {
            body.append("body", JSON.stringify(reqInfo.body))
        }
        console.log(body)
        return fetch(url.toString(), {
            // mode: "no-cors",
            body,
            method: "POST"
        }).then((response) => {
            if (response.ok) {
                RestLessClient.setCachedResponse(url.toString(), response);
            }
            return response;
        });
    }
}

const serverUrl = "http://localhost:3000";

const storageToken = "123456abcdef";

const getRandomString = () => Math.random().toString(16).substring(2);
const resources = new Array(2).fill(0).map(() => getRandomString());
resources.push("123456")
const getRandomResource = () => resources[Math.floor(Math.random() * resources.length)];

const data = {
    param1: "value",
    param2: "2",
    param3: "true",
};

const getResourceUrl = () => {
    const url = new URL(`/resource/${getRandomResource()}`, serverUrl);
    url.search = new URLSearchParams(data).toString();

    return url;
};

async function postForResource() {
    const url = getResourceUrl().toString();

    const result = await RestLessClient.request({
        url,
        method: "GET",
        headers:{
            Authorization: `Bearer ${storageToken}`,
            "x-correlation-id": getRandomString(),
        } 
    }).then((response) => {
        if (!response.ok) {
            console.error(response);
            throw Error(`${response.status} - ${response.statusText}`);
        }
        return response.json();
    }).catch((err) => console.error(err));
    console.log(result);
}

async function getForResource() {
    const result = await fetch(
        getResourceUrl().toString(),
        {
            headers: {
                Authorization: `Bearer ${storageToken} `
            }
        }).then((response) => {
            if (!response.ok) {
                throw Error(`${response.status} - ${response.statusText}`);
            }
    
            return response.json();
        });
    console.log(result);
}
