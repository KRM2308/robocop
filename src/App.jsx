import React, { useState } from 'react'

    export default function App() {
      const [todos, setTodos] = useState([])
      const [input, setInput] = useState('')

      const addTodo = () => {
        if (input.trim()) {
          setTodos([...todos, { text: input, completed: false }])
          setInput('')
        }
      }

      const toggleTodo = (index) => {
        const newTodos = [...todos]
        newTodos[index].completed = !newTodos[index].completed
        setTodos(newTodos)
      }

      const deleteTodo = (index) => {
        const newTodos = todos.filter((_, i) => i !== index)
        setTodos(newTodos)
      }

      return (
        <div className="min-h-screen p-8 font-robocop">
          <div className="max-w-4xl mx-auto bg-robocop-black p-6 rounded-lg neon-border">
            <h1 className="text-3xl font-bold mb-6 text-robocop-red glow">
              DIRECTIVES ROBOCOP
            </h1>
            <div className="flex gap-2 mb-6">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addTodo()}
                className="flex-1 p-2 bg-robocop-black text-robocop-silver border-robocop-red rounded focus:outline-none focus:ring-2 focus:ring-robocop-red"
                placeholder="Nouvelle directive..."
              />
              <button
                onClick={addTodo}
                className="px-4 py-2 bg-robocop-red text-robocop-black font-bold rounded hover:bg-robocop-blue transition-colors"
              >
                AJOUTER
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {todos.map((todo, index) => (
                <div key={index} className="p-4 bg-robocop-black rounded-lg neon-border">
                  <div className="flex items-center justify-between mb-2">
                    <input
                      type="checkbox"
                      checked={todo.completed}
                      onChange={() => toggleTodo(index)}
                      className="form-checkbox h-5 w-5 text-robocop-red rounded focus:ring-robocop-red"
                    />
                    <button
                      onClick={() => deleteTodo(index)}
                      className="text-robocop-red hover:text-robocop-blue transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                  <p className={todo.completed ? 'line-through text-robocop-silver/50' : 'text-robocop-silver'}>
                    {todo.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    }
