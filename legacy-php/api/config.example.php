<?php
// ============================================================
//  CONFIGURACIÓN DEL SERVIDOR  (edita estos valores)
// ============================================================

// Datos de tu base de datos MySQL (los das al crearla en cPanel / phpMyAdmin)
const DB_HOST = '127.0.0.1';
const DB_NAME = 'bichito_db';
const DB_USER = 'root';
const DB_PASS = '';

// Frase larga y secreta, solo para proteger la sesión del maestro. Cámbiala.
const SECRETO = 'cambia-esto-por-una-frase-larga-y-unica-1234567890';

// Desde qué páginas se permite usar esta API.
// - Si el juego está en el MISMO hosting que esta carpeta, déjalo vacío: []
// - Si el juego está en Netlify, pon tu dirección, por ejemplo:
//   ['https://orugagame.netlify.app']
const ORIGENES_PERMITIDOS = [];
