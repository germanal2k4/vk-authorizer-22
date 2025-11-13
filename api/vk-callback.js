// api/vk-callback.js
export default async function handler(req, res) {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).send('Ошибка: нет параметра code');

    const appId  = process.env.VK_APP_ID;   // 54317306
    const secret = process.env.VK_SECRET;   // 0Xcin4TXYPiyXYmWBDoc (в ENV, не в коде!)
    if (!appId || !secret) {
      return res.status(500).send('Ошибка конфигурации: нет VK_APP_ID/VK_SECRET');
    }

    // redirect должен ровно совпадать с тем, что в index.html и в настройках VK
    const redirect = 'https://vk-authorizer-22.vercel.app/vk/callback';

    const url = 'https://oauth.vk.com/access_token'
      + `?client_id=${encodeURIComponent(appId)}`
      + `&client_secret=${encodeURIComponent(secret)}`
      + `&redirect_uri=${encodeURIComponent(redirect)}`
      + `&code=${encodeURIComponent(code)}`;

    const r = await fetch(url);
    const data = await r.json(); // { access_token, user_id, expires_in, ... } либо { error, ... }

    if (data.error) {
      console.error('VK access_token error:', data);
      return res.status(400).send(`Ошибка VK: ${data.error_description || data.error}`);
    }

    // TODO: тут сохрани токен и user_id в свою БД/Google Sheet/вебхук
    // Временно просто показываем "Готово".
    console.log('VK TOKEN ISSUED:', {
      user_id: data.user_id,
      expires_in: data.expires_in,
      token_preview: data.access_token?.slice(0, 8) + '...'
    });

    // опционально: форвард токена в твой обработчик
    const forwardUrl = process.env.FORWARD_URL;
    if (forwardUrl) {
      await fetch(forwardUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'vk-oauth',
          user_id: data.user_id,
          access_token: data.access_token,
          expires_in: data.expires_in ?? null,
          ts: new Date().toISOString()
        })
      });
    }

    return res.status(200).send(`<!doctype html>
      <meta charset="utf-8"/>
      <title>Готово</title>
      <style>body{font-family:system-ui;padding:24px;background:#0b1220;color:#e6e8ec}</style>
      <h1>Готово ✅</h1>
      <p>Доступ выдан. Можете закрыть вкладку.</p>
      <p style="opacity:.7">user_id: <b>${data.user_id}</b>${data.expires_in ? `, expires_in: ${data.expires_in}s` : ''}</p>
    `);
  } catch (e) {
    console.error('Callback fatal error:', e);
    return res.status(500).send('Внутренняя ошибка колбэка');
  }
}
