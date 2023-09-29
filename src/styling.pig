(module styling
  (:import
    piglet:dom
    piglet:string))

(defn css [v]
  (cond
    (dict? v)
    (string:join "\n"
      (for [[k v] v]
        (str (name k) ": " (css v) ";")))
    (vector? v)
    (let [sel (first v)
          more (rest v)
          dicts (filter dict? more)
          vects (filter vector? more)]
      (str (name sel) " {\n" (string:join "\n" (map css dicts)) "\n}\n"
        (string:join "\n"
          (for [v vects]
            (str (name sel) " " (css v))))))
    (list? v)
    (string:join "\n" (map css v))
    (identifier? v)
    (name v)
    :else
    v))

(defonce style-el (doto (dom:dom js:document [:style])
                    ((partial dom:append js:document.head))))


(defn clear-styles! []
  (set! (.-innerHTML style-el) ""))

(defn style! [s]
  (set! (.-innerHTML style-el) (str
                                 (.-innerHTML style-el)
                                 (css s)))
  nil)
