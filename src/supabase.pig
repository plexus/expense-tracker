(module supabase)

(def supabase-url "https://zmjmdgzsikkpxfyhrvgy.supabase.co")
(def supabase-key "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjQyNTQxNTIyLCJleHAiOjE5NTgxMTc1MjJ9.DW0pUquR6G4j9Q-FtNCev_Eyp_gA789twsuN46PYAKM")

(defn supabase-fetch [request-method path opts]
  (let [token (:token opts supabase-key)]
    (prn opts)
    (prn token)
    (js:fetch
      (str supabase-url path)
      #js {:headers #js {:content-type "application/json;charset=UTF-8"
                         :x-client-info "piglet"
                         :authorization (str "Bearer " token)
                         :apikey supabase-key
                         :Sec-Fetch-Dest "empty"
                         :Sec-Fetch-Mode "cors"
                         :Sec-Fetch-Site "cross-site"
                         :Sec-GPC "1"
                         :Pragma "no-cache"
                         :Cache-Control "no-cache"}
           :referrer "http://localhost:8000/"
           :body (js:JSON.stringify (:body opts))
           :method (name request-method)
           :mode "cors"})))

(def GET (partial supabase-fetch :GET))
(def POST (partial supabase-fetch :POST))

(defn signup! [email password]
  (POST "/auth/v1/signup"
    {:body {:email email
            :password password
            :gotrue_meta_security {}}}))

(defn login! [email password]
  (POST "/auth/v1/token?grant_type=password"
    {:body {:email email
            :password password}}))
