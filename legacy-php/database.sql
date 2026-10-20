-- ============================================================
--  El Bichito y las Plantas  ·  Base de datos
--  Importar en phpMyAdmin: selecciona tu base de datos > Importar
--  (codificación del archivo: utf-8)
-- ============================================================
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS=0;
DROP TABLE IF EXISTS respuestas, partidas, alumnos, preguntas, niveles, ajustes;
SET FOREIGN_KEY_CHECKS=1;

CREATE TABLE ajustes (
  clave VARCHAR(40) NOT NULL PRIMARY KEY,
  valor TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE niveles (
  numero TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  nombre VARCHAR(60) NOT NULL,
  fondo VARCHAR(30) NOT NULL DEFAULT 'pradera',
  img VARCHAR(200) NOT NULL DEFAULT '',
  num_preguntas TINYINT UNSIGNED NOT NULL DEFAULT 3,
  suma SMALLINT UNSIGNED NOT NULL DEFAULT 10,
  resta SMALLINT UNSIGNED NOT NULL DEFAULT 5
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE preguntas (
  id INT UNSIGNED NOT NULL PRIMARY KEY,
  nivel TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '0 = comodín (todos los niveles)',
  planta VARCHAR(60) NOT NULL,
  emoji VARCHAR(16) NOT NULL DEFAULT '🌿',
  texto VARCHAR(300) NOT NULL,
  op1_texto VARCHAR(80) NOT NULL DEFAULT '', op1_emoji VARCHAR(16) NOT NULL DEFAULT '',
  op2_texto VARCHAR(80) NOT NULL DEFAULT '', op2_emoji VARCHAR(16) NOT NULL DEFAULT '',
  op3_texto VARCHAR(80) NOT NULL DEFAULT '', op3_emoji VARCHAR(16) NOT NULL DEFAULT '',
  correcta TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '0, 1 o 2 = opción correcta'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE alumnos (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(40) NOT NULL,
  creado TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE partidas (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  uid VARCHAR(40) NOT NULL,
  alumno_id INT UNSIGNED NOT NULL,
  inicio DATETIME NOT NULL,
  fin DATETIME NULL,
  nivel_max TINYINT UNSIGNED NOT NULL DEFAULT 1,
  puntos INT NOT NULL DEFAULT 0,
  estado VARCHAR(12) NOT NULL DEFAULT 'jugando',
  UNIQUE KEY uq_uid (uid),
  KEY k_alumno (alumno_id),
  CONSTRAINT fk_part_alumno FOREIGN KEY (alumno_id) REFERENCES alumnos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE respuestas (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  partida_id INT UNSIGNED NOT NULL,
  orden SMALLINT UNSIGNED NOT NULL,
  nivel TINYINT UNSIGNED NOT NULL,
  pregunta_id INT UNSIGNED NOT NULL DEFAULT 0,
  pregunta_texto VARCHAR(120) NOT NULL DEFAULT '',
  correcta TINYINT(1) NOT NULL DEFAULT 0,
  fecha DATETIME NOT NULL,
  UNIQUE KEY uq_orden (partida_id, orden),
  CONSTRAINT fk_resp_partida FOREIGN KEY (partida_id) REFERENCES partidas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------- Datos iniciales ----------------
INSERT INTO ajustes (clave, valor) VALUES ('puntos_iniciales', '30');

INSERT INTO niveles (numero,nombre,fondo,img,num_preguntas,suma,resta) VALUES
(1,'La pradera','pradera','',3,10,5),
(2,'El bosque','bosque','',3,10,5),
(3,'El atardecer','atardecer','',3,10,5),
(4,'La noche','noche','',3,10,5),
(5,'La montaña nevada','nieve','',3,10,5);

INSERT INTO preguntas (id,nivel,planta,emoji,texto,op1_texto,op1_emoji,op2_texto,op2_emoji,op3_texto,op3_emoji,correcta) VALUES
(1,1,'Manzanilla','🌼','¡Encontraste manzanilla! ¿Cuántas flores hay? 🌼🌼🌼','2','2️⃣','3','3️⃣','4','4️⃣',1),
(2,1,'Sábila','🌵','La sábila es verde. ¿Cuál de estas cosas también es verde?','La rana','🐸','El sol','☀️','La fresa','🍓',0),
(3,1,'Menta','🌿','Las plantas necesitan algo para crecer. ¿Qué es?','Zapato','👟','Agua','💧','Carro','🚗',1),
(4,2,'Lavanda','🪻','La lavanda huele muy rico. ¿Con qué parte del cuerpo olemos?','La nariz','👃','El pie','🦶','La mano','✋',0),
(5,2,'Albahaca','🌱','La albahaca es una planta pequeña. ¿Cuál de estos es más grande?','Un árbol','🌳','Una hormiga','🐜','Una semilla','🌰',0),
(6,2,'Caléndula','🏵️','La caléndula es de color naranja. ¿Cuál es naranja?','La naranja','🍊','La uva','🍇','La hoja','🍃',0),
(7,3,'Romero','🌿','El romero crece con el sol. ¿Qué vemos en el cielo de día?','La luna','🌙','El sol','☀️','Una estrella','⭐',1),
(8,3,'Yerbabuena','🍃','Cuenta las hojas. ¿Cuántas hojas hay? 🍃🍃','1','1️⃣','2','2️⃣','5','5️⃣',1),
(9,3,'Eucalipto','🌳','El eucalipto es un árbol alto. ¿Quién vive en los árboles?','Un pez','🐟','Un pájaro','🐦','Una vaca','🐄',1),
(10,4,'Toronjil','🌿','Es de noche. ¿Qué vemos en el cielo de noche?','La luna','🌙','El sol','☀️','Un carro','🚗',0),
(11,4,'Valeriana','🌸','La valeriana ayuda a dormir. ¿Qué hacemos de noche?','Dormir','😴','Correr','🏃','Comer helado','🍦',0),
(12,4,'Orégano','🌿','Cuenta las estrellas. ¿Cuántas estrellas hay? ⭐⭐⭐⭐','3','3️⃣','4','4️⃣','5','5️⃣',1),
(13,5,'Jengibre','🌱','La nieve es muy fría. ¿Qué nos ponemos cuando hace frío?','Un abrigo','🧥','Sandalias','🩴','Gafas de sol','🕶️',0),
(14,5,'Tomillo','🌿','El tomillo es verde. ¿De qué color es la nieve?','Blanca','⚪','Roja','🔴','Negra','⚫',0),
(15,5,'Ruda','🌿','¡Última planta! ¿Cuántos deditos tiene una mano?','3','3️⃣','5','5️⃣','8','8️⃣',1);
