(module main
  (:import
    piglet:dom
    piglet:reactive
    piglet:web/ui
    styling
    supabase))

(styling:clear-styles!)

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

(def !inspect (reactive:cell nil))
(def !token (reactive:cell
              (js:localStorage.getItem "expense-tracker-supabase-token")))

(add-watch! !token ::store-token
  (fn [k r o n]
    (if n
      (js:localStorage.setItem "expense-tracker-supabase-token" n)
      (js:localStorage.removeItem "expense-tracker-supabase-token"))))

(defn add-entry! [data]
  (supabase:POST "/rest/v1/expenses"
    {:token @!token
     :body data}))

(styling:style!
  [:.main_main-panel
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

(defc main-panel []
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
    [:a {:href "#" :on-click (fn [e] (.preventDefault e) (reset! !token nil))} "[Logout]"]]
   [:div.inputs
    [:label {:for "description"} "Description"] [:input {:name "description"}]
    [:label {:for "amount"} "Amount"] [:input {:name "amount" :type "number" :placeholder "0.00" :pattern "^\d+(?:\.\d{1,2})?$" :step ".01"}]]
   [:button "Add"]])

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
   {:on-submit (fn ^:async _ [e]
                 (.preventDefault e)
                 (let [{:keys [email password]} (form-data (:target e))
                       result (await (supabase:login! email password))
                       json (await (.json result))]
                   (reset! !token (:access_token json))
                   (reset! !inspect json)))}
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

   [:* {:font-family "B612, sans-serif"}]
   [:pre {:white-space "pre-wrap"}]])

(defc app []
  [:div
   (if @!token
     [main-panel]
     [login-panel])
   #_
   [:pre
      (print-str @!inspect)]])

(web/ui:render
  (dom:el-by-id js:document "app") [app])
