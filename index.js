const { createServer } = require("http");
const url = require("url");
const { Pool } = require("pg")

const conPool = new Pool({
    host: 'localhost',
    port: 5432,
    database: "dvdrental",
    user: "postgres",
    password: "postgres"
})


createServer((request, response) => {
    const urlParsed = url.parse(request.url, true);
    response.setHeader("Content-Type","application/json");


    if(request.method == "POST" && urlParsed.pathname == "/actor/assign") {
        let body = "";
        request.on("data", (chunk) => {
            body += chunk.toString();
        });

        return request.on("end", async() => {
            body = JSON.parse(body);
            const { rows, rowCount } = await conPool.query("SELECT * FROM actor LIMIT 5");
            console.log({ rowCount, rows });
            response.end(JSON.stringify({ message: "Asignando"}));
        })
        
    }

    response.writeHead(404);
    response.end(JSON.stringify({ message: "Ruta no encontrada"}));
}).listen(3000, () => console.log("Servicio ejecutándose por el puerto 3000"))

