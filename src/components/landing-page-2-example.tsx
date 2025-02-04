'use client'

import { useState, useRef, ReactNode, FC, ButtonHTMLAttributes, HTMLAttributes } from 'react'
import Image from 'next/image'
import { Upload, Phone, Globe, FileText, Users, Zap, Gift } from 'lucide-react'

// Button component
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string
  children: ReactNode
}

const Button: FC<ButtonProps> = ({ className, children, ...props }) => (
  <button
    className={`px-4 py-2 rounded-md font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 ${className}`}
    {...props}
  >
    {children}
  </button>
)

// Card component
interface CardProps extends HTMLAttributes<HTMLDivElement> {
  className?: string
  children: ReactNode
}

const Card: FC<CardProps> = ({ children, className, ...props }) => (
  <div className={`bg-white rounded-lg shadow-md ${className}`} {...props}>
    {children}
  </div>
)

const CardContent: FC<CardProps> = ({ children, className, ...props }) => (
  <div className={`p-6 ${className}`} {...props}>
    {children}
  </div>
)

export function LandingPage_2Example() {
  const [assistantType, setAssistantType] = useState('cloned')
  const [showForm, setShowForm] = useState(false)
  const [websiteUrl, setWebsiteUrl] = useState('')
  const topRef = useRef<HTMLDivElement>(null)

  const handleCreateAssistant = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    // Implement assistant creation logic based on assistantType
    console.log('Creating assistant:', assistantType)
    // Add API call and error handling here
  }

  const handleScrapeWebsite = () => {
    // Implement website scraping logic
    console.log('Scraping website:', websiteUrl)
    // Add API call and error handling here
  }

  const scrollToTop = () => {
    topRef.current?.scrollIntoView({ behavior: 'smooth' })
    setShowForm(true)
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      <header className="flex justify-between items-center p-6 bg-white shadow-sm">
        <div className="flex items-center">
          <Image src="/logo.svg" alt="SimplyTalk.ai Logo" width={32} height={32} />
          <span className="ml-2 text-xl font-bold text-[#1e293b]">SimplyTalk.ai</span>
        </div>
        <button className="text-[#1e293b] hover:bg-[#f1f5f9] px-4 py-2 rounded-md">Profile</button>
      </header>
      <main className="flex-grow">
        <section ref={topRef} className="py-12 md:py-24 lg:py-32">
          <div className="container px-4 md:px-6">
            <div className="grid gap-6 lg:grid-cols-[1fr_400px] lg:gap-12 xl:grid-cols-[1fr_600px]">
              <div className="flex flex-col justify-center space-y-4">
                <div className="space-y-2">
                  <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none">
                    Build Lifelike Voice & Video AI Agents
                  </h1>
                  <p className="max-w-[600px] text-muted-foreground md:text-xl">
                    Create ultra-realistic AI assistants for phone calls and video chats. 
                    Choose between voice cloning or real-time synthesis for inbound and outbound 
                    customer interactions that businesses can trust.
                  </p>
                </div>
                {!showForm && (
                  <Button 
                    className="bg-[#3b82f6] hover:bg-[#2563eb] text-white w-fit"
                    onClick={() => setShowForm(true)}
                  >
                    Create AI Agent
                  </Button>
                )}
                {showForm && (
                  <Card className="w-full max-w-md">
                    <CardContent>
                      <div className="flex mb-6">
                        <button
                          className={`flex-1 py-2 text-center ${assistantType === 'cloned' ? 'bg-white text-[#1e293b]' : 'bg-[#e2e8f0] text-[#64748b]'}`}
                          onClick={() => setAssistantType('cloned')}
                        >
                          Cloned Voice Agent
                        </button>
                        <button
                          className={`flex-1 py-2 text-center ${assistantType === 'realtime' ? 'bg-white text-[#1e293b]' : 'bg-[#e2e8f0] text-[#64748b]'}`}
                          onClick={() => setAssistantType('realtime')}
                        >
                          Realtime Voice Agent
                        </button>
                      </div>
                      {assistantType === 'realtime' && (
                        <p className="text-xs text-[#64748b] mb-4">Powered by OpenAI advanced voice mode</p>
                      )}
                      <form onSubmit={handleCreateAssistant} className="space-y-4">
                        <input 
                          type="text" 
                          placeholder="Assistant Name" 
                          required 
                          className="w-full px-3 py-2 border border-[#e2e8f0] rounded-md"
                        />
                        <textarea 
                          placeholder="Instructions" 
                          required 
                          className="w-full px-3 py-2 border border-[#e2e8f0] rounded-md"
                        />
                        <input 
                          type="text" 
                          placeholder="First Message" 
                          required 
                          className="w-full px-3 py-2 border border-[#e2e8f0] rounded-md"
                        />
                        {assistantType === 'cloned' && (
                          <>
                            <div className="flex items-center space-x-2">
                              <input type="file" id="training-content" className="hidden" />
                              <button
                                type="button"
                                onClick={() => document.getElementById('training-content')?.click()}
                                className="px-4 py-2 border border-[#e2e8f0] text-[#64748b] hover:bg-[#f1f5f9] rounded-md flex items-center"
                              >
                                <Upload className="mr-2 h-4 w-4" />
                                Choose Training Content
                              </button>
                              <span className="text-sm text-[#64748b]">No file chosen</span>
                            </div>
                            <div className="flex space-x-2">
                              <input
                                type="text"
                                placeholder="Enter website URL"
                                value={websiteUrl}
                                onChange={(e) => setWebsiteUrl(e.target.value)}
                                className="flex-grow px-3 py-2 border border-[#e2e8f0] rounded-md"
                              />
                              <button 
                                type="button" 
                                onClick={handleScrapeWebsite}
                                className="px-4 py-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-md"
                              >
                                Scrape
                              </button>
                            </div>
                          </>
                        )}
                        {assistantType === 'realtime' && (
                          <>
                            <input 
                              type="password" 
                              placeholder="OpenAI API Key (optional)" 
                              className="w-full px-3 py-2 border border-[#e2e8f0] rounded-md"
                            />
                            <div className="space-y-2">
                              <label htmlFor="voice-select" className="text-sm font-medium text-[#1e293b]">
                                Choose your voice
                              </label>
                              <select 
                                id="voice-select"
                                className="w-full px-3 py-2 border border-[#e2e8f0] rounded-md bg-white"
                                defaultValue="alloy"
                              >
                                <option value="alloy">Alloy</option>
                                <option value="echo">Echo</option>
                                <option value="fable">Fable</option>
                                <option value="onyx">Onyx</option>
                                <option value="nova">Nova</option>
                              </select>
                            </div>
                          </>
                        )}
                        <Button 
                          type="submit" 
                          className="w-full py-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-md"
                        >
                          Create {assistantType === 'cloned' ? 'Cloned' : 'Realtime'} Voice Agent
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                )}
              </div>
              <div className="bg-[#f1f5f9] p-12 rounded-lg">
                <Image
                  src="/placeholder.svg?height=600&width=600"
                  alt="AI Agent Illustration"
                  width={600}
                  height={600}
                  className="rounded-lg"
                />
              </div>
            </div>
          </div>
        </section>
    
        <section className="py-12 md:py-24 lg:py-32 bg-white">
          <div className="container px-4 md:px-6">
            <h2 className="text-3xl font-bold mb-8 text-center text-[#1e293b]">The First Voice and Video AI Agent Creation Platform</h2>
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardContent>
                  <Gift className="h-12 w-12 mb-4 text-[#3b82f6]" />
                  <h3 className="text-xl font-semibold mb-2">Build or Choose</h3>
                  <p className="text-[#64748b]">Create your own AI agents from scratch or choose from our upcoming marketplace of pre-built agents.</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent>
                  <Zap className="h-12 w-12 mb-4 text-[#3b82f6]" />
                  <h3 className="text-xl font-semibold mb-2">Revolutionary AI Speech</h3>
                  <p className="text-[#64748b]">Choose between cloned voices with ElevenLabs or advanced Realtime AI powered by OpenAI for natural, dynamic conversations.</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent>
                  <Globe className="h-12 w-12 mb-4 text-[#3b82f6]" />
                  <h3 className="text-xl font-semibold mb-2">Omnichannel Deployment</h3>
                  <p className="text-[#64748b]">Deploy your AI agents on both phone and web platforms with customizable avatars and Twilio integration.</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent>
                  <FileText className="h-12 w-12 mb-4 text-[#3b82f6]" />
                  <h3 className="text-xl font-semibold mb-2">Content-Based Capabilities</h3>
                  <p className="text-[#64748b]">Enhance your agents with RAG technology, allowing them to learn from your documents and websites.</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent>
                  <Users className="h-12 w-12 mb-4 text-[#3b82f6]" />
                  <h3 className="text-xl font-semibold mb-2">Advanced AI Swarms</h3>
                  <p className="text-[#64748b]">Connect multiple AI agents to create complex swarms capable of tackling advanced, multi-step tasks.</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent>
                  <Phone className="h-12 w-12 mb-4 text-[#3b82f6]" />
                  <h3 className="text-xl font-semibold mb-2">Customizable Avatars</h3>
                  <p className="text-[#64748b]">Upload your own GIFs to create unique, branded video avatars for web-based interactions.</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
    
        <section className="py-12 md:py-24 lg:py-32 bg-[#f8fafc]">
          <div className="container px-4 md:px-6">
            <div className="grid gap-10 lg:grid-cols-2">
              <div>
                <h2 className="text-3xl font-bold mb-4 text-[#1e293b]">Experience the Future of AI Interactions</h2>
                <p className="text-lg mb-6 text-[#64748b]">
                  Whether you&apos;re looking to enhance customer service, create virtual assistants, or develop complex AI workflows, 
                  SimplyTalk.ai provides the tools and flexibility you need to bring your vision to life.
                </p>
                <ul className="space-y-4">
                  <li className="flex items-center text-[#64748b]">
                    <Zap className="h-5 w-5 mr-2 text-[#3b82f6]" />
                    Natural conversations with emotion sensing and dynamic responses
                  </li>
                  <li className="flex items-center text-[#64748b]">
                    <Globe className="h-5 w-5 mr-2 text-[#3b82f6]" />
                    Seamless integration with Twilio for phone and web deployment
                  </li>
                  <li className="flex items-center text-[#64748b]">
                    <FileText className="h-5 w-5 mr-2 text-[#3b82f6]" />
                    RAG capabilities for content-rich, context-aware interactions
                  </li>
                </ul>
              </div>
              <div className="bg-white p-8 rounded-lg shadow-lg">
                <h3 className="text-2xl font-semibold mb-4 text-[#1e293b]">Get Started Today</h3>
                <p className="mb-6 text-[#64748b]">
                  Join the AI revolution and start creating your own custom AI agents or prepare for our upcoming marketplace launch.
                </p>
                
                <Button className="w-full bg-[#3b82f6] hover:bg-[#2563eb] text-white" onClick={scrollToTop}>
                  Create Your First AI Agent
                </Button>
                <p className="mt-4 text-sm text-center text-[#64748b]">
                  Need custom AI development? <a href="#" className="text-[#3b82f6] hover:underline">Contact our team</a>
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="bg-white border-t border-[#e2e8f0] py-6">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-2">
              <Image src="/logo.svg" alt="SimplyTalk.ai Logo" width={24} height={24} />
              <span className="text-sm font-medium">© 2024 SimplyTalk.ai. All rights reserved.</span>
            </div>
            <nav className="flex gap-4">
              <a href="#" className="text-sm hover:underline">Terms</a>
              <a href="#" className="text-sm hover:underline">Privacy</a>
              <a href="#" className="text-sm hover:underline">Contact</a>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  )
}
