(module main
  (:import
    piglet:dom
    piglet:reactive
    piglet:web/ui
    piglet:string
    styling
    supabase))

(def !state (reactive:cell (if-let [json (js:localStorage.getItem "expense-tracker-state")]
                             (js:JSON.parse json)
                             #js {})))

(add-watch! !state ::store-state
  (fn [k r o n]
    (js:localStorage.setItem "expense-tracker-state" (js:JSON.stringify n))))

(def !access-token (reactive:cursor !state [:access-token]))
(def !refresh-token (reactive:cursor !state [:refresh-token]))
(def !expires-at (reactive:cursor !state [:expires-at]))
(def !expenses (reactive:cursor !state [:expenses]))

(defn store-auth-result! [{:keys [access_token refresh_token expires_at] :as r}]
  (swap! !state assoc
    :access-token access_token
    :refresh-token refresh_token
    :expires-at expires_at))

(defn ^:async supabase-fetch [request-method path opts]
  (when (< (* 1000 (- @!expires-at 300)) (js:Date.now))
    (store-auth-result! (await (.json (await (supabase:refresh-token! @!refresh-token))))))
  (let [response (await (supabase:supabase-fetch request-method path (assoc opts :token @!access-token)))
        headers (into {} (:headers response))]
    (await
      (if (and (= 200 (:status response))
            (string:includes? (get headers "content-type" "") "application/json"))
        (.json response)
        response))))

(defn ^:async fetch-expenses! []
  (reset! !expenses (await (supabase-fetch :GET "/rest/v1/expenses?select=*" {}))))

(defn ^:async supabase-login! [email password]
  (store-auth-result! (await (.json (await (supabase:login! email password)))))
  (await (fetch-expenses!)))

(defn ^:async add-entry! [data]
  (await (supabase-fetch :POST "/rest/v1/expenses" {:body data}))
  (await (fetch-expenses!)))

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(dom:append js:document.head
  (dom:dom js:document [:link {:rel "stylesheet" :href "fonts.css"}]))

(defn start-of-week [date]
  (doto (js:Date. date)
    (.setDate (- (.getDate date) (.getDay date) -1))
    (.setHours 0)
    (.setMinutes 0)
    (.setSeconds 0)
    (.setMilliseconds 0)))

(defn form-data [form]
  (into {}
    (map (juxt (comp keyword first) second)
      (js:FormData. form))))

(defmacro defc [comp-name ?doc ?argv & body]
  (let [[doc argv body]
        (if (string? ?doc)
          [?doc ?argv body]
          [nil ?doc (cons ?argv body)])]
    `(defn ~comp-name ~@(when doc [doc]) ~argv
       (let [[tag# & more# :as form#] (do ~@body)]
         (if (keyword? tag#)
           (into
             [(keyword (str (name tag#) ~(str "." (.-name *current-module*) "_" (name comp-name))))]
             more#)
           form#)))))

(styling:style!
  [:.main_add-entry-form
   {:background-color "#aaa"
    :padding "1rem"
    :margin "1rem 0"}
   [:.inputs
    {:display "grid"
     :grid-template-columns "repeat(2, 1fr)"}]
   [:button {:margin "1rem" :padding "0.25rem 1rem"}]])

(defc add-entry-form []
  [:form
   {:on-submit (fn ^:async _ [e]
                 (.preventDefault e)
                 (let [form (:target e)
                       data (form-data form)
                       _ (await (add-entry!
                                  (update data :amount
                                    (fn [a]
                                      (js:Math.round (* 100 (js:parseFloat a 10)))))))]
                   (.reset form)))}
   [:p "Expense Tracker. "
    [:a {:href "#" :on-click (fn [e] (.preventDefault e) (reset! !access-token nil))} "[Logout]"]]
   [:div.inputs
    [:label {:for "description"} "Description"] [:input {:name "description"}]
    [:label {:for "amount"} "Amount"] [:input {:name "amount" :type "number" :placeholder "0.00" :pattern "^\d+(?:\.\d{1,2})?$" :step ".01"}]]
   [:button "Add"]])

(styling:style!
  [:.main_main-panel
   {:max-width "20rem"
    :display "flex"
    :flex-direction "column"
    :align-items "center"
    }
   [:.entries
    {:align-self "flex-start"
     :width "100%"
     :padding "1rem"
     :display "table"}
    [:>div {:display "table-row"
            :background-color "hsla(0,100%,95%,1)"
            :padding "0.9rem 0"}]
    [">div:nth-child(2n+1)" {:background-color "hsla(150,100%,95%,1)"}]]
   [:span {:display "table-cell"
           :padding "0.2rem"}]
   [:.week-head {:margin-top "2rem"
                 :padding "1rem"
                 :background-color "hsla(200,100%,80%,1)"}]])

(defn sort-by [key-fn arr]
  (.sort (js:Array.from (or arr [])) (fn [this that]
                                       (< (key-fn this) (key-fn that)))))

(defn group-by [key-fn arr]
  (reduce (fn [acc o]
            (update acc (key-fn o) (fnil conj []) o))
    {} arr))

(defn total [entries]
  (/ (apply + (map :amount entries)) 100))

(defc main-panel []
  (let [by-week (group-by (comp
                            (fn [d](.toISOString d))
                            start-of-week
                            (fn [d] (js:Date. d))
                            :created_at) @!expenses)]
    [:main
     [add-entry-form]
     [:div "This week €" (total (get by-week (.toISOString (start-of-week (js:Date.)))))]
     [:div "Total: €" (total @!expenses)]
     (for [[week-start entries] (sort-by first by-week)]
       [:span.week-head "Week of " (.slice week-start 0 10) " (€" (total entries) ")"]
       [:div.entries
        (for [{:keys [created_at description amount]} (sort-by :created_at entries)]
         [:div
          [:span.created-at (.slice created_at 0 10)]
          [:span.description description] " "
          [:span.amount "€" (/ amount 100)] " "])])]))

(styling:style!
  [:.main_login-panel
   {:max-width "20rem"
    :display "flex"
    :flex-direction "column"
    :align-items "center"
    :background-color "#aaa"
    :padding "1rem"}
   [:.inputs
    {:display "grid"
     :grid-template-columns "repeat(2, 1fr)"}]
   [:button {:margin "1rem" :padding "0.25rem 1rem"}]])

(defc login-panel []
  [:form
   {:on-submit (fn [e]
                 (.preventDefault e)
                 (let [{:keys [email password]} (form-data (:target e))]
                   (supabase-login! email password)))}
   [:div.inputs
    [:label {:for "email"} "Email"]
    [:input {:name "email"}]
    [:label {:for "Password"} "Password"]
    [:input {:name "password" :type "password"}]]
   [:button "Login"]])

(styling:style!
  [:.main_app
   {:display "flex"
    :flex-direction "column"
    :max-width "40rem"
    :margin "0 auto"
    :padding "1rem"
    :background-color "#ccc"
    :align-items "center"}

   [:* {:font-family "B612, sans-serif"
        :box-sizing "border-box"}]
   [:pre {:white-space "pre-wrap"}]])

(defc app []
  [:div
   (if @!access-token
     [main-panel]
     [login-panel])])

(defonce root (dom:el-by-id js:document "app"))

(when-let [spinner (dom:el-by-id js:document "spinner")]
  (.remove spinner))

(web/ui:render root [app])

(defonce initial-fetch
  (js:requestAnimationFrame
    (fn []
      (when @!access-token
        (fetch-expenses!)))))
