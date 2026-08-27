# Ejercicio 4: arquitectura y seguridad

## 1. Flujo de autenticación con JWT y refresh tokens

El usuario envía sus credenciales por HTTPS al servicio `auth-core`. Este servicio valida la contraseña usando un hash seguro y, si las credenciales son correctas, genera dos elementos: un access token JWT de corta duración y un refresh token aleatorio de mayor duración. El access token incluye únicamente datos necesarios, como el identificador del usuario, sus permisos, el emisor, la audiencia y las fechas de emisión y expiración.

```text
Usuario
   |
   | 1. Credenciales por HTTPS
   v
auth-core
   |
   | 2. Access token JWT + refresh token
   v
Cliente web
   |
   | 3. Authorization: Bearer <access_token>
   v
API pública
   |
   | 4. Valida firma, expiración, emisor y audiencia
   v
Microservicio solicitado
```

El cliente envía el access token en el encabezado `Authorization: Bearer`. La API valida la firma con la clave pública de `auth-core`, además de comprobar `exp`, `iss`, `aud` y los permisos requeridos. Cuando el access token expira, el cliente envía el refresh token únicamente al endpoint de renovación de `auth-core`; si es válido, el servicio rota el refresh token y entrega un nuevo par.

## 2. Almacenamiento del refresh token

En una aplicación web almacenaría el refresh token en una cookie con `HttpOnly`, `Secure` y una política `SameSite` adecuada. `HttpOnly` impide que JavaScript lea el token si ocurre un ataque XSS, mientras que `Secure` obliga a enviarlo únicamente mediante HTTPS. Como las cookies se envían automáticamente, también implementaría protección CSRF en el endpoint de renovación.

En el servidor guardaría solamente el hash del refresh token, asociado con el usuario, dispositivo, fecha de expiración y estado de revocación. Esto permite cerrar una sesión específica, rotar tokens y detectar la reutilización de un token anterior. Evitaría `localStorage` porque cualquier script ejecutado mediante XSS podría extraer el token; guardarlo solo en memoria reduce ese riesgo, pero se pierde al recargar la página y afecta la continuidad de la sesión.

## 3. Autenticación entre el Servicio A y el Servicio B

Para una llamada interna no reutilizaría automáticamente el mismo token del usuario. El Servicio A se autenticaría ante `svc-mesh-assert` mediante una identidad propia del servicio, por ejemplo mTLS o credenciales de cliente de corta duración. El token interno tendría una audiencia limitada al Servicio B, permisos mínimos y una vigencia breve.

```text
Servicio A -- identidad de servicio --> svc-mesh-assert --> Servicio B
                 token interno              valida audiencia y permisos
```

Si el Servicio B necesita conocer al usuario que originó la operación, utilizaría intercambio de tokens: `auth-core` emitiría un token interno delegado que conserve el identificador del usuario, pero con audiencia y permisos limitados al Servicio B. Así se mantiene la trazabilidad sin permitir que el token público circule libremente por todos los microservicios.

## 4. Vulnerabilidad del middleware JWT

El problema es el uso de `jwt.decode(token)`. Esta función solamente interpreta el contenido y no comprueba la firma, por lo que un atacante podría fabricar un token, asignarse privilegios administrativos y enviarlo a la API. Además, el fragmento no separa el prefijo `Bearer`, no controla tokens ausentes y no valida expiración, emisor ni audiencia.

Una corrección posible sería:

```javascript
app.use((req, res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  const token = authorization.slice(7);

  try {
    req.user = jwt.verify(token, PUBLIC_KEY, {
      algorithms: ['RS256'],
      issuer: 'auth-core',
      audience: 'api-assert',
    });

    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
});
```

La lista fija de algoritmos evita aceptar uno diferente al definido por la arquitectura. La clave privada permanece únicamente en `auth-core`; los servicios validadores reciben la clave pública mediante un mecanismo seguro de distribución y rotación.

## 5. Renovación y expiración de tokens

Usaría access tokens con una duración corta, por ejemplo 15 minutos, y refresh tokens con una duración mayor y limitada, por ejemplo 7 días. Poco antes de expirar el access token, el cliente solicitaría silenciosamente uno nuevo a `auth-core`, sin pedir nuevamente las credenciales al usuario. Cada renovación invalidaría el refresh token anterior y generaría uno nuevo.

También aplicaría detección de reutilización: si se presenta un refresh token que ya fue rotado, revocaría la familia completa de tokens y solicitaría un nuevo inicio de sesión. El cierre de sesión revocaría el refresh token del dispositivo y eliminaría su cookie. Para operaciones sensibles, como cambiar datos de pago, podría solicitar una autenticación reciente aunque la sesión siga vigente.
