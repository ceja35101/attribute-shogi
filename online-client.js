/* global supabase */
(() => {
  const config = window.ATTRIBUTE_SHOGI_SUPABASE || {};
  const configured = /^https:\/\/.+\.supabase\.co$/.test(config.url || "") && Boolean(config.publishableKey);
  let client = null;

  function getClient() {
    if (!configured) throw new Error("SUPABASE_NOT_CONFIGURED");
    if (!window.supabase?.createClient) throw new Error("SUPABASE_CLIENT_UNAVAILABLE");
    if (!client) client = window.supabase.createClient(config.url, config.publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });
    return client;
  }

  async function authenticate() {
    const api = getClient();
    let { data: { session } } = await api.auth.getSession();
    if (!session) {
      const result = await api.auth.signInAnonymously();
      if (result.error) throw result.error;
      session = result.data.session;
    }
    return session.user;
  }

  async function rpc(name, args) {
    const api = getClient();
    await authenticate();
    const { data, error } = await api.rpc(name, args);
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  }

  async function createRoom(code, gameState) {
    return rpc("create_shogi_room", { p_code: code, p_state: gameState });
  }

  async function joinRoom(code) {
    return rpc("join_shogi_room", { p_code: code });
  }

  async function submitState(roomId, revision, gameState) {
    return rpc("submit_shogi_state", { p_room_id: roomId, p_expected_revision: revision, p_state: gameState });
  }

  async function getRoom(roomId) {
    const api = getClient();
    await authenticate();
    const { data, error } = await api.from("shogi_rooms").select("*").eq("id", roomId).single();
    if (error) throw error;
    return data;
  }

  async function subscribe(roomId, onUpdate, onStatus) {
    const api = getClient();
    await authenticate();
    const channel = api.channel(`shogi-room:${roomId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "shogi_rooms", filter: `id=eq.${roomId}` }, payload => onUpdate(payload.new))
    await new Promise((resolve, reject) => {
      const timer=setTimeout(()=>reject(new Error("Realtime subscription timed out")),10000);
      channel.subscribe(status => {
        onStatus?.(status);
        if(status==="SUBSCRIBED"){clearTimeout(timer);resolve()}
        if(status==="CHANNEL_ERROR"||status==="TIMED_OUT"){clearTimeout(timer);reject(new Error(`Realtime ${status.toLowerCase()}`))}
      });
    });
    return () => api.removeChannel(channel);
  }

  window.AttributeShogiOnline = { configured, authenticate, createRoom, joinRoom, submitState, getRoom, subscribe };
})();
