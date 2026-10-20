<?php
require __DIR__ . '/config.php';

// Por si el hosting no tiene la extensión mbstring
if (!function_exists('mb_substr')) { function mb_substr($s, $a, $n = null) { return implode('', array_slice(preg_split('//u', $s, -1, PREG_SPLIT_NO_EMPTY), $a, $n)); } }
if (!function_exists('mb_strlen')) { function mb_strlen($s) { return count(preg_split('//u', $s, -1, PREG_SPLIT_NO_EMPTY)); } }

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

/* ---------- CORS (permite que el juego en Netlify llame a esta API) ---------- */
$origen = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origen && (!ORIGENES_PERMITIDOS || in_array($origen, ORIGENES_PERMITIDOS, true))) {
    header('Access-Control-Allow-Origin: ' . $origen);
    header('Vary: Origin');
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
}
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }

/* ---------- utilidades ---------- */
function out(array $d) { echo json_encode($d + ['ok' => true], JSON_UNESCAPED_UNICODE); exit; }
function fail(string $m, int $c = 400) { http_response_code($c); echo json_encode(['ok' => false, 'error' => $m], JSON_UNESCAPED_UNICODE); exit; }
function db(): PDO {
    static $p = null;
    if (!$p) {
        $p = new PDO('mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4', DB_USER, DB_PASS,
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
    }
    return $p;
}
function ajuste(string $k) { $s = db()->prepare('SELECT valor FROM ajustes WHERE clave=?'); $s->execute([$k]); return $s->fetchColumn(); }
function set_ajuste(string $k, string $v) {
    db()->prepare('INSERT INTO ajustes(clave,valor) VALUES(?,?) ON DUPLICATE KEY UPDATE valor=VALUES(valor)')->execute([$k, $v]);
}
function ent($v, int $min, int $max, int $def = 0): int { return is_numeric($v) ? max($min, min($max, (int)$v)) : $def; }
function txt($v, int $n): string { return mb_substr(trim((string)$v), 0, $n); }
function f_in($iso) { $t = $iso ? strtotime((string)$iso) : false; return $t ? gmdate('Y-m-d H:i:s', $t) : null; }
function f_out($d) { return $d ? gmdate('c', strtotime($d . ' UTC')) : null; }

/* ---------- sesión del maestro (token firmado, dura 8 horas) ---------- */
function token_nuevo(): string { $e = time() + 8 * 3600; return $e . '.' . hash_hmac('sha256', (string)$e, SECRETO); }
function token_ok($t): bool {
    if (!is_string($t) || strpos($t, '.') === false) return false;
    [$e, $h] = explode('.', $t, 2);
    return ctype_digit($e) && (int)$e > time() && hash_equals(hash_hmac('sha256', $e, SECRETO), $h);
}
function admin(array $in) { if (!token_ok($in['token'] ?? '')) fail('Sesión vencida. Entra de nuevo con el PIN.', 401); }

/* ---------- petición ---------- */
$in = json_decode(file_get_contents('php://input'), true);
if (!is_array($in)) $in = [];
$accion = (string)($in['action'] ?? '');

try {
    switch ($accion) {

    /* ===== Público: el juego lee niveles y preguntas ===== */
    case 'config':
        $niv = db()->query('SELECT nombre,fondo,img,num_preguntas,suma,resta FROM niveles ORDER BY numero')->fetchAll();
        if (!$niv) fail('La base de datos no tiene niveles. Importa database.sql', 500);
        $pre = db()->query('SELECT * FROM preguntas ORDER BY id')->fetchAll();
        $cfg = [
            'puntosIniciales' => (int)(ajuste('puntos_iniciales') ?: 30),
            'niveles' => array_map(fn($l) => ['nombre' => $l['nombre'], 'fondo' => $l['fondo'], 'img' => $l['img'],
                'numPreguntas' => (int)$l['num_preguntas'], 'suma' => (int)$l['suma'], 'resta' => (int)$l['resta']], $niv),
            'preguntas' => array_map(fn($q) => ['id' => (int)$q['id'], 'nivel' => (int)$q['nivel'], 'planta' => $q['planta'],
                'emoji' => $q['emoji'], 'texto' => $q['texto'],
                'ops' => [[$q['op1_texto'], $q['op1_emoji']], [$q['op2_texto'], $q['op2_emoji']], [$q['op3_texto'], $q['op3_emoji']]],
                'ok' => (int)$q['correcta']], $pre),
        ];
        out(['cfg' => $cfg]);

    /* ===== Público: el juego guarda la partida de un niño ===== */
    case 'partida_guardar':
        $s = $in['sesion'] ?? null;
        if (!is_array($s)) fail('Datos no válidos');
        $uid = (string)($s['uid'] ?? '');
        if (!preg_match('/^[A-Za-z0-9]{6,40}$/', $uid)) fail('Identificador no válido');
        $nombre = txt($s['alumno'] ?? '', 40);
        if ($nombre === '') fail('Falta el nombre');
        $estado = in_array($s['estado'] ?? '', ['jugando', 'perdió', 'completó'], true) ? $s['estado'] : 'jugando';
        $pdo = db(); $pdo->beginTransaction();
        $pdo->prepare('INSERT INTO alumnos(nombre) VALUES(?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)')->execute([$nombre]);
        $aid = (int)$pdo->lastInsertId();
        $pdo->prepare('INSERT INTO partidas(uid,alumno_id,inicio,fin,nivel_max,puntos,estado) VALUES(?,?,?,?,?,?,?)
            ON DUPLICATE KEY UPDATE fin=VALUES(fin),nivel_max=VALUES(nivel_max),puntos=VALUES(puntos),estado=VALUES(estado)')
            ->execute([$uid, $aid, f_in($s['inicio'] ?? '') ?: gmdate('Y-m-d H:i:s'), f_in($s['fin'] ?? ''),
                       ent($s['nivelMax'] ?? 1, 1, 99, 1), ent($s['puntos'] ?? 0, 0, 100000), $estado]);
        $q = $pdo->prepare('SELECT id FROM partidas WHERE uid=?'); $q->execute([$uid]); $pid = (int)$q->fetchColumn();
        $ins = $pdo->prepare('INSERT IGNORE INTO respuestas(partida_id,orden,nivel,pregunta_id,pregunta_texto,correcta,fecha) VALUES(?,?,?,?,?,?,?)');
        foreach (array_slice(array_values(is_array($s['resp'] ?? null) ? $s['resp'] : []), 0, 500) as $k => $r) {
            if (!is_array($r)) continue;
            $ins->execute([$pid, $k, ent($r['n'] ?? 1, 1, 99, 1), ent($r['q'] ?? 0, 0, 2147483647), txt($r['t'] ?? '', 120),
                           empty($r['ok']) ? 0 : 1, f_in($r['f'] ?? '') ?: gmdate('Y-m-d H:i:s')]);
        }
        $pdo->commit();
        out([]);

    /* ===== Maestro ===== */
    case 'login':
        $h = ajuste('pin_hash'); $pin = (string)($in['pin'] ?? '');
        $ok = $h ? password_verify($pin, $h) : ($pin === '1234');   // sin PIN guardado: vale 1234
        if (!$ok) { sleep(1); fail('PIN incorrecto', 403); }
        out(['token' => token_nuevo(), 'pinPorDefecto' => !$h]);

    case 'cambiar_pin':
        admin($in);
        $pin = (string)($in['pin'] ?? '');
        if (mb_strlen($pin) < 4 || mb_strlen($pin) > 30) fail('El PIN debe tener entre 4 y 30 caracteres');
        set_ajuste('pin_hash', password_hash($pin, PASSWORD_DEFAULT));
        out([]);

    case 'guardar_config':
        admin($in);
        $c = $in['cfg'] ?? null;
        if (!is_array($c) || empty($c['niveles']) || !is_array($c['niveles']) || !is_array($c['preguntas'] ?? null)) fail('Datos no válidos');
        $pdo = db(); $pdo->beginTransaction();
        set_ajuste('puntos_iniciales', (string)ent($c['puntosIniciales'] ?? 30, 1, 999, 30));
        $st = $pdo->prepare('INSERT INTO niveles(numero,nombre,fondo,img,num_preguntas,suma,resta) VALUES(?,?,?,?,?,?,?)
            ON DUPLICATE KEY UPDATE nombre=VALUES(nombre),fondo=VALUES(fondo),img=VALUES(img),num_preguntas=VALUES(num_preguntas),suma=VALUES(suma),resta=VALUES(resta)');
        $n = 0;
        foreach (array_slice(array_values($c['niveles']), 0, 20) as $i => $l) {
            $n = $i + 1;
            $fondo = preg_replace('/[^a-z0-9_]/i', '', txt($l['fondo'] ?? 'pradera', 30)) ?: 'pradera';
            $st->execute([$n, txt($l['nombre'] ?? ('Nivel ' . $n), 60), $fondo, txt($l['img'] ?? '', 200),
                ent($l['numPreguntas'] ?? 3, 1, 10, 3), ent($l['suma'] ?? 0, 0, 100), ent($l['resta'] ?? 0, 0, 100)]);
        }
        $pdo->prepare('DELETE FROM niveles WHERE numero>?')->execute([$n]);
        $pdo->exec('DELETE FROM preguntas');
        $st = $pdo->prepare('INSERT INTO preguntas(id,nivel,planta,emoji,texto,op1_texto,op1_emoji,op2_texto,op2_emoji,op3_texto,op3_emoji,correcta) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)');
        $usados = [];
        foreach (array_slice($c['preguntas'], 0, 1000) as $q) {
            if (!is_array($q) || txt($q['texto'] ?? '', 300) === '') continue;
            $id = ent($q['id'] ?? 0, 0, 2147483000, 0);
            if (!$id || isset($usados[$id])) $id = max(array_merge([0], array_keys($usados))) + 1;
            $usados[$id] = 1;
            $o = is_array($q['ops'] ?? null) ? $q['ops'] : [];
            $f = [];
            for ($k = 0; $k < 3; $k++) { $f[] = txt($o[$k][0] ?? '', 80); $f[] = txt($o[$k][1] ?? '', 16); }
            $st->execute(array_merge([$id, ent($q['nivel'] ?? 0, 0, 20, 0), txt($q['planta'] ?? 'Planta', 60), txt($q['emoji'] ?? '🌿', 16), txt($q['texto'], 300)],
                $f, [ent($q['ok'] ?? 0, 0, 2, 0)]));
        }
        $pdo->commit();
        out([]);

    case 'stats':
        admin($in);
        $rows = db()->query('SELECT p.id,a.nombre,p.inicio,p.fin,p.nivel_max,p.puntos,p.estado
            FROM partidas p JOIN alumnos a ON a.id=p.alumno_id ORDER BY p.inicio DESC LIMIT 3000')->fetchAll();
        $by = [];
        foreach ($rows as $r) {
            $by[(int)$r['id']] = ['id' => (int)$r['id'], 'alumno' => $r['nombre'], 'inicio' => f_out($r['inicio']), 'fin' => f_out($r['fin']),
                'nivelMax' => (int)$r['nivel_max'], 'puntos' => (int)$r['puntos'], 'estado' => $r['estado'], 'resp' => []];
        }
        if ($by) {
            $ids = implode(',', array_map('intval', array_keys($by)));
            $rs = db()->query("SELECT partida_id,nivel,pregunta_id,pregunta_texto,correcta,fecha FROM respuestas WHERE partida_id IN ($ids) ORDER BY partida_id,orden")->fetchAll();
            foreach ($rs as $r) {
                $by[(int)$r['partida_id']]['resp'][] = ['n' => (int)$r['nivel'], 'q' => (int)$r['pregunta_id'], 't' => $r['pregunta_texto'],
                    'ok' => (bool)$r['correcta'], 'f' => f_out($r['fecha'])];
            }
        }
        out(['sesiones' => array_reverse(array_values($by))]);   // de la más antigua a la más reciente

    case 'borrar_stats':
        admin($in);
        $pdo = db(); $pdo->beginTransaction();
        $pdo->exec('DELETE FROM respuestas'); $pdo->exec('DELETE FROM partidas'); $pdo->exec('DELETE FROM alumnos');
        $pdo->commit();
        out([]);

    default:
        fail('Acción desconocida');
    }
} catch (Throwable $e) {
    try { if (db()->inTransaction()) db()->rollBack(); } catch (Throwable $e2) {}
    error_log('bichito api: ' . $e->getMessage());
    fail('Error del servidor', 500);
}
