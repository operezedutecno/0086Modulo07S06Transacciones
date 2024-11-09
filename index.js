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

            try {
                await conPool.query("BEGIN");

                // Consulta para validar si el actor o actriz existe   
                const { rows: actors, rowCount: actorFind } = await conPool.query(
                    "SELECT * FROM actor WHERE first_name ilike $1 AND last_name ilike $2",
                    [ body.first_name, body.last_name]
                );

                let actor;
                if(actorFind == 0) { // Si el actor o actriz no existe se registra.
                    // Consulta para insertar actor o actriz
                    let result = await conPool.query(
                        "INSERT INTO actor(first_name, last_name) VALUES($1, $2) RETURNING *",
                        [body.first_name, body.last_name]
                    );
                    actor = result.rows[0];
                } else {
                    actor = actors[0]
                }

                const { rows: films, rowCount: filmFind} = await conPool.query("SELECT * FROM film WHERE title ilike $1", [body.title]);
                if(filmFind == 0) {
                    response.writeHead(422);
                    throw "Película no existe"
                } else { // Escenario donde la película si existe.
                    const result = await conPool.query(
                        "INSERT INTO film_actor(film_id, actor_id) VALUES($1,$2)",
                        [films[0].film_id, actor.actor_id]
                    );
                    await conPool.query("COMMIT");
                    response.end(JSON.stringify({ message: "Actor asignado a la película de manera exitosa", actor, film: films[0]}));
                }
            } catch (error) {
                await conPool.query("ROLLBACK");
                response.writeHead(422);
                response.end(JSON.stringify({ message: error.message || 'Error interno'}));
            }   
        })
        
    }

    response.writeHead(404);
    response.end(JSON.stringify({ message: "Ruta no encontrada"}));
}).listen(3000, () => console.log("Servicio ejecutándose por el puerto 3000"))

