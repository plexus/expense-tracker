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
     :padding "1rem"}]
   [:.description {:padding "0 1rem"}]
   [:.amount {:float "right"}]])

(defn sort-by [key-fn arr]
  (.sort (js:Array.from (or arr [])) (fn [this that]
                                       (< (key-fn this) (key-fn that)))))

(defc main-panel []
  [:main
   [add-entry-form]
   [:div "Total: €" (/ (apply + (map :amount @!expenses)) 100)]
   [:div.entries
    (for [{:keys [created_at description amount]} (sort-by :created_at @!expenses)]
      [:div
       [:span.created-at (.slice created_at 0 10)]
       [:span.description description] " "
       [:span.amount "€" (/ amount 100)] " "])]])

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

(web/ui:render
  (dom:el-by-id js:document "app") [app])

(js:requestAnimationFrame
  (fn []
    (when @!access-token
      (fetch-expenses!))))
