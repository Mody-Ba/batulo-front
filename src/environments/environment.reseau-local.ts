/**
 * Test depuis un téléphone sur le même Wi-Fi (npm run start:reseau) : apiUrl vide, les appels partent en relatif
 * (/api/...) vers le serveur de développement, qui les transmet au backend sur localhost:8090 (proxy.conf.json).
 * Remplace environment.ts seulement dans la configuration « reseau-local » d'angular.json.
 */
export const environment = {
  production: false,
  apiUrl: '',
};
