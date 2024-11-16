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

    if(request.method == "POST" && urlParsed.pathname == "/category/assign") {
        let body = "";
        request.on("data", (chunk) => {
            body += chunk.toString();
        });

        return request.on("end", async() => {
            body = JSON.parse(body);

            await conPool.query("BEGIN");
            
            try {
                const resultCategory = await conPool.query("SELECT * FROM category WHERE name ilike $1", [body.category_name]);
                if(resultCategory.rowCount == 0) {
                    response.writeHead(404);
                    return response.end(JSON.stringify({ message: "Categoría no existente"}));
                }
                const [category] = resultCategory.rows

                const resultFilm = await conPool.query(
                    "SELECT * FROM film WHERE title ilike $1 AND release_year=$2",
                    [body.title, body.release_year]
                )


                if(resultFilm.rowCount == 0) {
                    const insertFilm = await conPool.query(
                        `INSERT INTO film (
                                        title, description, release_year, language_id, rental_duration, 
                                        rental_rate, length, replacement_cost, rating, last_update
                        ) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, now()) RETURNING *;`, 
                        [
                            body.title, body.description, body.release_year, body.language_id, body.rental_duration,
                            body.rental_rate, body.length, body.replacement_cost, body.rating
                        ]
                    );
                    var [film] = insertFilm.rows
                } else {
                    const updateFilm = await conPool.query(
                        `UPDATE film set title=$1, description=$2, release_year=$3, language_id=$4, 
                                rental_duration=$5, rental_rate=$6, length=$7, replacement_cost=$8, 
                                rating=$9, last_update=now()
                        WHERE title=$1 AND release_year=$3
                        RETURNING *;`, 
                        [
                            body.title, body.description, body.release_year, body.language_id, body.rental_duration,
                            body.rental_rate, body.length, body.replacement_cost, body.rating
                        ]
                    );
                    var [film] = updateFilm.rows
                    console.log({ film });
                }

                const assignResult = await conPool.query(
                    "INSERT INTO film_category(film_id, category_id, last_update) VALUES($1, $2, now())",
                    [film.film_id, category.category_id]
                )

                await conPool.query("COMMIT");
                return response.end(JSON.stringify({ message: "Categoría asignada a la película de manera exitosa"}));
            } catch (error) {
                await conPool.query("ROLLBACK");
                return response.end(JSON.stringify({ message: error.message || "Error interno del servidor"}));
            }
           
        });
        
    }

    response.writeHead(404);
    response.end(JSON.stringify({ message: "Ruta no encontrada"}));
}).listen(3000, () => console.log("Servicio ejecutándose por el puerto 3000"))

