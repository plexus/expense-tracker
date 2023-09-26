(module main
  (:import
    piglet:dom
    piglet:reactive
    piglet:web/ui
    supabase))

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

(def !inspect (reactive:cell))
(def !token (reactive:cell))

(defn add-entry! [data]
  (supabase:POST "/rest/v1/expenses"
    {:token @!token
     :body data}))

(defc main-panel []
  (let [!desc-ref (reactive:cell)
        !amount-ref (reactive:cell)]
    [:form
     {:on-submit (fn ^:async _ [e]
                   (.preventDefault e)
                   (add-entry! {:description (.-value @!desc-ref)
                                :amount (js:Math.round (* 100 (js:parseFloat (.-value @!amount-ref) 10)))}))}
     [:p "You are logged in"]
     [:label "Description" [:input {:ref (partial reset! !desc-ref)}]]
     [:label "Amount" [:input {:ref (partial reset! !amount-ref)}]]
     [:button "Add"]]))

(defc login-panel []
  (let [!email-ref (reactive:cell)
        !password-ref (reactive:cell)]
    [:form
     {:on-submit (fn ^:async _ [e]
                   (.preventDefault e)
                   (let [result (await (supabase:login! (.-value @!email-ref) (.-value @!password-ref)))
                         json (await (.json result))]
                     (reset! !token (:access_token json))
                     (reset! !inspect json)))}
     [:label "Email" [:input {:ref (partial reset! !email-ref)}]]
     [:label "Password" [:input {:ref (partial reset! !password-ref)}]]
     [:button "Login"]]))

(defc app []
  [:div
   (if @!token
     [main-panel]
     [login-panel])
   [:pre
      (print-str @!inspect)]])

(web/ui:render
  (dom:el-by-id js:document "app") [app])
