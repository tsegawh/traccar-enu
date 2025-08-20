
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  MapPin, 
  Shield, 
  Clock, 
  Users, 
  CheckCircle, 
  ArrowRight,
  Star,
  Zap,
  Globe,
  BarChart3
} from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

interface SubscriptionPlan {
  id: string;
  name: string;
  deviceLimit: number;
  durationDays: number;
  price: number;
  description: string;
}

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const response = await axios.get('/subscription/plans');
      setPlans(response.data.plans);
    } catch (error) {
      console.error('Error fetching plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (planId: string) => {
    if (!user) {
      navigate('/login');
      return;
    }

    setPurchasing(planId);

    try {
      // First try to upgrade
      const upgradeResponse = await axios.post('/subscription/upgrade', { planId });
      
      if (upgradeResponse.data.requiresPayment) {
        // Initiate payment
        const paymentResponse = await axios.post('/payment/pay', { planId });
        
        if (paymentResponse.data.checkoutUrl) {
          // Redirect to Telebirr checkout
          window.location.href = paymentResponse.data.checkoutUrl;
        }
      } else {
        // Free upgrade
        toast.success('Subscription activated successfully!');
        navigate('/dashboard');
      }
    } catch (error: any) {
      const message = error.response?.data?.error || 'Failed to process subscription';
      toast.error(message);
    } finally {
      setPurchasing(null);
    }
  };

  const features = [
    {
      icon: <MapPin className="w-6 h-6" />,
      title: "Real-time GPS Tracking",
      description: "Track your vehicles and assets in real-time with precise location data"
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: "Advanced Security",
      description: "Secure data transmission and storage with enterprise-grade encryption"
    },
    {
      icon: <Clock className="w-6 h-6" />,
      title: "24/7 Monitoring",
      description: "Round-the-clock monitoring with instant alerts and notifications"
    },
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: "Detailed Analytics",
      description: "Comprehensive reports and analytics for better decision making"
    }
  ];

  const testimonials = [
    {
      name: "Sarah Johnson",
      role: "Fleet Manager",
      content: "This GPS tracking service has revolutionized how we manage our delivery fleet. Real-time tracking and alerts have improved our efficiency by 40%.",
      rating: 5
    },
    {
      name: "Mike Chen",
      role: "Business Owner",
      content: "Easy to use interface and reliable tracking. Perfect for keeping track of our company vehicles and ensuring driver safety.",
      rating: 5
    },
    {
      name: "Emma Wilson",
      role: "Logistics Coordinator",
      content: "The detailed analytics and reporting features help us optimize routes and reduce fuel costs. Highly recommended!",
      rating: 5
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <MapPin className="w-8 h-8 text-primary-600" />
              <span className="ml-2 text-xl font-bold text-gray-900">TrackPro</span>
            </div>
            <div className="flex items-center space-x-4">
              {user ? (
                <Link
                  to="/dashboard"
                  className="btn-primary"
                >
                  Go to Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/register"
                    className="btn-primary"
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary-50 to-primary-100 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
              Professional GPS Tracking
              <span className="text-primary-600"> Made Simple</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Monitor your vehicles, assets, and fleet in real-time with our advanced GPS tracking platform. 
              Get insights, improve efficiency, and ensure security with enterprise-grade solutions.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/register"
                className="btn-primary text-lg px-8 py-3"
              >
                Start Free Trial
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
              <a
                href="#pricing"
                className="btn-secondary text-lg px-8 py-3"
              >
                View Pricing
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Why Choose Our GPS Tracking Service?
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Built for businesses of all sizes with powerful features and reliable performance
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full text-primary-600 mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Statistics Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-primary-600 mb-2">10K+</div>
              <div className="text-gray-600">Active Devices</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary-600 mb-2">99.9%</div>
              <div className="text-gray-600">Uptime Guarantee</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary-600 mb-2">24/7</div>
              <div className="text-gray-600">Support Available</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary-600 mb-2">5★</div>
              <div className="text-gray-600">Customer Rating</div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Choose Your Plan
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Flexible pricing plans designed to grow with your business needs
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center">
              <div className="loading-spinner w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {plans.map((plan, index) => (
                <div
                  key={plan.id}
                  className={`relative rounded-2xl border-2 p-8 ${
                    index === 1
                      ? 'border-primary-500 bg-primary-50 scale-105'
                      : 'border-gray-200 bg-white'
                  } transition-all hover:border-primary-300 hover:shadow-lg`}
                >
                  {index === 1 && (
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                      <span className="bg-primary-600 text-white px-4 py-1 rounded-full text-sm font-medium">
                        Most Popular
                      </span>
                    </div>
                  )}
                  
                  <div className="text-center">
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">
                      {plan.name}
                    </h3>
                    <div className="mb-4">
                      <span className="text-4xl font-bold text-gray-900">
                        {plan.price === 0 ? 'Free' : `$${plan.price}`}
                      </span>
                      {plan.price > 0 && (
                        <span className="text-gray-600">/{plan.durationDays} days</span>
                      )}
                    </div>
                    <p className="text-gray-600 mb-6">{plan.description}</p>
                  </div>

                  <div className="space-y-4 mb-8">
                    <div className="flex items-center">
                      <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
                      <span className="text-gray-700">
                        Up to {plan.deviceLimit} devices
                      </span>
                    </div>
                    <div className="flex items-center">
                      <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
                      <span className="text-gray-700">Real-time tracking</span>
                    </div>
                    <div className="flex items-center">
                      <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
                      <span className="text-gray-700">Mobile app access</span>
                    </div>
                    <div className="flex items-center">
                      <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
                      <span className="text-gray-700">Email notifications</span>
                    </div>
                    {plan.price > 0 && (
                      <>
                        <div className="flex items-center">
                          <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
                          <span className="text-gray-700">Priority support</span>
                        </div>
                        <div className="flex items-center">
                          <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
                          <span className="text-gray-700">Advanced analytics</span>
                        </div>
                      </>
                    )}
                  </div>

                  <button
                    onClick={() => handlePurchase(plan.id)}
                    disabled={purchasing === plan.id}
                    className={`w-full py-3 px-6 rounded-lg font-semibold transition-colors ${
                      index === 1
                        ? 'bg-primary-600 text-white hover:bg-primary-700'
                        : 'bg-gray-900 text-white hover:bg-gray-800'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {purchasing === plan.id ? (
                      <div className="flex items-center justify-center">
                        <div className="loading-spinner w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                        Processing...
                      </div>
                    ) : (
                      plan.price === 0 ? 'Start Free' : 'Get Started'
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              What Our Customers Say
            </h2>
            <p className="text-xl text-gray-600">
              Join thousands of satisfied customers who trust our GPS tracking service
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="bg-white rounded-lg p-6 shadow-sm">
                <div className="flex items-center mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-gray-700 mb-6">"{testimonial.content}"</p>
                <div>
                  <div className="font-semibold text-gray-900">{testimonial.name}</div>
                  <div className="text-sm text-gray-600">{testimonial.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Start Tracking?
          </h2>
          <p className="text-xl text-primary-100 mb-8 max-w-2xl mx-auto">
            Join thousands of businesses who trust our GPS tracking platform for their fleet management needs.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/register"
              className="bg-white text-primary-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
            >
              Start Free Trial
            </Link>
            <Link
              to="/login"
              className="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center mb-4">
                <MapPin className="w-8 h-8 text-primary-400" />
                <span className="ml-2 text-xl font-bold">TrackPro</span>
              </div>
              <p className="text-gray-400">
                Professional GPS tracking solutions for modern businesses.
              </p>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white">Features</a></li>
                <li><a href="#pricing" className="hover:text-white">Pricing</a></li>
                <li><a href="#" className="hover:text-white">Mobile App</a></li>
                <li><a href="#" className="hover:text-white">API</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-4">Support</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white">Help Center</a></li>
                <li><a href="#" className="hover:text-white">Contact Us</a></li>
                <li><a href="#" className="hover:text-white">Documentation</a></li>
                <li><a href="#" className="hover:text-white">System Status</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white">About Us</a></li>
                <li><a href="#" className="hover:text-white">Blog</a></li>
                <li><a href="#" className="hover:text-white">Careers</a></li>
                <li><a href="#" className="hover:text-white">Privacy Policy</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2024 TrackPro. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
