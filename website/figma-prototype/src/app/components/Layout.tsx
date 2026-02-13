import { Link, Outlet } from 'react-router-dom';
import { Bot, Home } from 'lucide-react';

export const Layout = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <Link to="/" className="flex-shrink-0 flex items-center gap-2 group">
                <div className="bg-indigo-600 p-2 rounded-lg group-hover:bg-indigo-700 transition-colors">
                  <Bot className="h-6 w-6 text-white" />
                </div>
                <span className="font-bold text-xl text-gray-900 tracking-tight">AI Agent Registry</span>
              </Link>
            </div>
            <nav className="flex items-center gap-4">
              <Link 
                to="/" 
                className="text-gray-500 hover:text-indigo-600 px-3 py-2 rounded-md text-sm font-medium flex items-center gap-1 transition-colors"
              >
                <Home className="h-4 w-4" />
                Startseite
              </Link>
            </nav>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <p className="text-center text-gray-400 text-sm">
            © {new Date().getFullYear()} AI Agent Registry. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};
