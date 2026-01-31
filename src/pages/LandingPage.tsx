/**
 * 1.3.40: YUIChat 官网落地页
 * 支持多语言：中文、日语、英语
 */

import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';

// 语言切换组件
const LanguageSwitcher = () => {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const languages = [
    { code: 'zh', label: '中文', flag: '🇨🇳' },
    { code: 'ja', label: '日本語', flag: '🇯🇵' },
    { code: 'en', label: 'English', flag: '🇺🇸' }
  ];

  const currentLang = languages.find(l => l.code === i18n.language) || languages[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <span>{currentLang.flag}</span>
        <span className="text-sm font-medium">{currentLang.label}</span>
        <i className={`fa-solid fa-chevron-down text-xs transition-transform ${isOpen ? 'rotate-180' : ''}`}></i>
      </button>
      {isOpen && (
        <div className="absolute top-full right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[120px] z-50">
          {languages.map(lang => (
            <button
              key={lang.code}
              onClick={() => {
                i18n.changeLanguage(lang.code);
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-gray-50 transition-colors ${
                lang.code === i18n.language ? 'bg-purple-50 text-purple-600' : ''
              }`}
            >
              <span>{lang.flag}</span>
              <span className="text-sm">{lang.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const LandingPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // 加载 Font Awesome（中文字体已移至全局 index.html）
  useEffect(() => {
    // Font Awesome
    const faLink = document.createElement('link');
    faLink.rel = 'stylesheet';
    faLink.href = 'https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css';
    document.head.appendChild(faLink);
    
    return () => {
      document.head.removeChild(faLink);
    };
  }, []);

  // 滚动动画 - 添加可见类
  useEffect(() => {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, observerOptions);

    document.querySelectorAll('.fade-in').forEach(el => {
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  // 导航栏滚动效果
  useEffect(() => {
    const handleScroll = () => {
      const navbar = document.querySelector('.landing-navbar');
      if (navbar) {
        if (window.scrollY > 50) {
          navbar.classList.add('scrolled');
        } else {
          navbar.classList.remove('scrolled');
        }
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleCTA = () => {
    navigate('/auth');
  };

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="landing-page">
      {/* 导航栏 */}
      <nav className="landing-navbar">
        <div className="landing-container navbar-content">
          <a href="#" className="logo">
            <img 
              src="/logo.svg" 
              alt="YUIChat Logo" 
              className="logo-img"
              onError={(e) => {
                // 如果SVG加载失败，尝试PNG
                const target = e.target as HTMLImageElement;
                if (target.src.endsWith('.svg')) {
                  target.src = '/logo.png';
                }
              }}
            />
          </a>
          <ul className="nav-menu">
            <li><a href="#solution" onClick={(e) => { e.preventDefault(); scrollToSection('solution'); }}>{t('landing.navSolution')}</a></li>
            <li><a href="#features" onClick={(e) => { e.preventDefault(); scrollToSection('features'); }}>{t('landing.navFeatures')}</a></li>
            <li><a href="#cases" onClick={(e) => { e.preventDefault(); scrollToSection('cases'); }}>{t('landing.navCases')}</a></li>
            <li><a href="#pricing" onClick={(e) => { e.preventDefault(); scrollToSection('pricing'); }}>{t('landing.navPricing')}</a></li>
            <li><LanguageSwitcher /></li>
            <li>
              <button onClick={handleCTA} className="btn btn-primary nav-cta">
                {t('landing.freeTrial')}
              </button>
            </li>
          </ul>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero">
        {/* Background Elements */}
        <div className="hero-bg-shape-1"></div>
        <div className="hero-bg-shape-2"></div>
        <div className="hero-bg-pattern"></div>
        
        <div className="landing-container">
          <div className="hero-content">
            {/* Title with highlight */}
            <h1 className="hero-title" dangerouslySetInnerHTML={{ __html: t('landing.heroTitleHtml') }} />
            
            {/* Subtitle in glass card */}
            <div className="hero-subtitle-card">
              <p className="hero-subtitle" dangerouslySetInnerHTML={{ __html: t('landing.heroSubtitleHtml') }} />
            </div>
            
            {/* Core Value Cards */}
            <div className="hero-value-cards">
              <div className="hero-value-card">
                <div className="hero-value-icon purple">
                  <i className="fa-solid fa-bolt-lightning"></i>
                </div>
                <h3>{t('landing.valueSpeed')}</h3>
                <p>{t('landing.valueSpeedDesc')}</p>
              </div>
              
              <div className="hero-value-card">
                <div className="hero-value-icon pink">
                  <i className="fa-solid fa-hand-holding-dollar"></i>
                </div>
                <h3>{t('landing.valueCost')}</h3>
                <p>{t('landing.valueCostDesc')}</p>
              </div>
              
              <div className="hero-value-card">
                <div className="hero-value-icon indigo">
                  <i className="fa-solid fa-user-group"></i>
                </div>
                <h3>{t('landing.valueEasy')}</h3>
                <p>{t('landing.valueEasyDesc')}</p>
              </div>
            </div>

            <div className="hero-cta">
              <button onClick={handleCTA} className="btn btn-primary hero-btn">
                <i className="fa-solid fa-rocket"></i> {t('landing.tryFree14Days')}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section id="problem" className="section problem-section">
        <div className="landing-container">
          <h2 className="section-title">{t('landing.problemTitle')}</h2>
          <p className="section-subtitle">{t('landing.problemSubtitle')}</p>
          
          <div className="problem-cards fade-in">
            <div className="problem-card">
              <div className="problem-card-header">
                <div className="problem-icon">
                  <i className="fa-solid fa-money-bill-wave"></i>
                </div>
                <div className="problem-stat">
                  <span className="stat-number">30<span className="stat-unit">%</span></span>
                  <span className="stat-label">{t('landing.problemStat1Label')}</span>
                </div>
              </div>
              <h3>{t('landing.problem1Title')}</h3>
              <p>{t('landing.problem1Desc')}</p>
            </div>

            <div className="problem-card">
              <div className="problem-card-header">
                <div className="problem-icon">
                  <i className="fa-solid fa-clock"></i>
                </div>
                <div className="problem-stat">
                  <span className="stat-number">2~4<span className="stat-unit">h</span></span>
                  <span className="stat-label">{t('landing.problemStat2Label')}</span>
                </div>
              </div>
              <h3>{t('landing.problem2Title')}</h3>
              <p>{t('landing.problem2Desc')}</p>
            </div>

            <div className="problem-card">
              <div className="problem-card-header">
                <div className="problem-icon">
                  <i className="fa-solid fa-folder-open"></i>
                </div>
                <div className="problem-stat">
                  <span className="stat-number">1.8<span className="stat-unit">h</span></span>
                  <span className="stat-label">{t('landing.problemStat3Label')}</span>
                </div>
              </div>
              <h3>{t('landing.problem3Title')}</h3>
              <p>{t('landing.problem3Desc')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section id="solution" className="section solution-section">
        <div className="landing-container solution-content">
          {/* Header */}
          <div className="solution-header">
            <h2 className="solution-title" dangerouslySetInnerHTML={{ __html: t('landing.solutionHeadlineHtml') }} />
          </div>
          
          {/* Solution Cards */}
          <div className="solution-cards fade-in">
            <div className="solution-card">
              <div className="card-number">01</div>
              <div className="solution-icon pink">
                <i className="fa-solid fa-piggy-bank"></i>
              </div>
              <h3>{t('landing.solution1Title')}</h3>
              <span className="solution-subtitle">COST SAVING</span>
              <p dangerouslySetInnerHTML={{ __html: t('landing.solution1DescHtml') }} />
            </div>

            <div className="solution-card">
              <div className="card-number">02</div>
              <div className="solution-icon blue">
                <i className="fa-solid fa-bolt-lightning"></i>
              </div>
              <h3>{t('landing.solution2Title')}</h3>
              <span className="solution-subtitle">TIME SAVING</span>
              <p dangerouslySetInnerHTML={{ __html: t('landing.solution2DescHtml') }} />
            </div>

            <div className="solution-card">
              <div className="card-number">03</div>
              <div className="solution-icon green">
                <i className="fa-solid fa-face-smile-beam"></i>
              </div>
              <h3>{t('landing.solution3Title')}</h3>
              <span className="solution-subtitle">STRESS FREE</span>
              <p dangerouslySetInnerHTML={{ __html: t('landing.solution3DescHtml') }} />
            </div>
          </div>
        </div>
      </section>

      {/* Comparison Section */}
      <section className="section comparison-section">
        <div className="landing-container">
          <h2 className="section-title">{t('landing.comparisonTitle')}</h2>
          <p className="section-subtitle">{t('landing.comparisonSubtitle')}</p>
          
          <div className="comparison-container fade-in">
            <div className="comparison-card">
              <div className="comparison-card-header">
                <div className="comparison-icon old">
                  <i className="fa-solid fa-user-group"></i>
                </div>
                <div className="comparison-stat">
                  <span className="stat-number old">¥600<span className="stat-unit">{t('landing.tenThousand')}</span></span>
                  <span className="stat-label">{t('landing.annualLaborCost')}</span>
                </div>
              </div>
              <h3>{t('landing.traditionalMethod')}</h3>
              <p>{t('landing.traditionalMethodDesc')}</p>
            </div>

            <div className="comparison-divider">
              <i className="fa-solid fa-arrow-right"></i>
            </div>

            <div className="comparison-card">
              <div className="comparison-card-header">
                <div className="comparison-icon new">
                  <i className="fa-solid fa-robot"></i>
                </div>
                <div className="comparison-stat">
                  <span className="stat-number new">¥18<span className="stat-unit">{t('landing.tenThousand')}</span></span>
                  <span className="stat-label">{t('landing.annualSystemCost')}</span>
                </div>
              </div>
              <h3>YUIChat</h3>
              <p>{t('landing.yuichatMethodDesc')}</p>
            </div>
          </div>

          <div className="savings-highlight fade-in">
            <p>{t('landing.annualSave')}</p>
            <div className="amount">¥582{t('landing.tenThousand')}</div>
          </div>
        </div>
      </section>

      {/* Steps Section */}
      <section className="section steps-section">
        <div className="landing-container">
          <h2 className="section-title">{t('landing.stepsTitle')}</h2>
          <p className="section-subtitle">{t('landing.stepsSubtitle')}</p>
          
          <div className="steps-container fade-in">
            <div className="step-card">
              <div className="step-card-header">
                <div className="step-icon">
                  <i className="fa-solid fa-cloud-arrow-up"></i>
                </div>
                <div className="step-stat">
                  <span className="stat-number">01</span>
                  <span className="stat-label">{t('landing.step1Title')}</span>
                </div>
              </div>
              <p>{t('landing.step1Desc')}</p>
            </div>

            <div className="step-card">
              <div className="step-card-header">
                <div className="step-icon">
                  <i className="fa-solid fa-comment-dots"></i>
                </div>
                <div className="step-stat">
                  <span className="stat-number">02</span>
                  <span className="stat-label">{t('landing.step2Title')}</span>
                </div>
              </div>
              <p>{t('landing.step2Desc')}</p>
            </div>

            <div className="step-card">
              <div className="step-card-header">
                <div className="step-icon">
                  <i className="fa-solid fa-bolt"></i>
                </div>
                <div className="step-stat">
                  <span className="stat-number">03</span>
                  <span className="stat-label">{t('landing.step3Title')}</span>
                </div>
              </div>
              <p>{t('landing.step3Desc')}</p>
            </div>
          </div>

          <div className="steps-emphasis-cards fade-in">
            <div className="emphasis-card">
              <i className="fa-solid fa-graduation-cap"></i>
              <span>{t('landing.noTraining1')}</span>
            </div>
            <div className="emphasis-card">
              <i className="fa-solid fa-user-slash"></i>
              <span>{t('landing.noTraining2')}</span>
            </div>
            <div className="emphasis-card">
              <i className="fa-solid fa-rocket"></i>
              <span>{t('landing.noTraining3')}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Efficiency Section */}
      <section className="section efficiency-section">
        <div className="landing-container">
          <h2 className="section-title">{t('landing.efficiencyTitle')}</h2>
          <p className="section-subtitle">{t('landing.efficiencySubtitle')}</p>
          
          <div className="efficiency-cards fade-in">
            <div className="efficiency-card">
              <div className="efficiency-icon pink">
                <i className="fa-solid fa-clock-rotate-left"></i>
              </div>
              <h3>{t('landing.efficiency1Title')}</h3>
              <div className="before-value">{t('landing.efficiency1Before')}</div>
              <div className="after-value">1{t('landing.second')}</div>
              <div className="improvement-tag">
                <i className="fa-solid fa-arrow-up"></i> {t('landing.efficiency1Improve')}
              </div>
            </div>

            <div className="efficiency-card">
              <div className="efficiency-icon blue">
                <i className="fa-solid fa-robot"></i>
              </div>
              <h3>{t('landing.efficiency2Title')}</h3>
              <div className="before-value">{t('landing.efficiency2Before')}</div>
              <div className="after-value">40%</div>
              <div className="improvement-tag">
                <i className="fa-solid fa-check-double"></i> {t('landing.efficiency2Improve')}
              </div>
            </div>

            <div className="efficiency-card">
              <div className="efficiency-icon green">
                <i className="fa-solid fa-stopwatch"></i>
              </div>
              <h3>{t('landing.efficiency3Title')}</h3>
              <div className="before-value">{t('landing.efficiency3Before')}</div>
              <div className="after-value">1{t('landing.minute')}</div>
              <div className="improvement-tag">
                <i className="fa-solid fa-gauge-high"></i> {t('landing.efficiency3Improve')}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid Section */}
      <section id="features" className="section features-section">
        <div className="landing-container">
          <h2 className="section-title">{t('landing.featuresTitle')}</h2>
          <p className="section-subtitle">{t('landing.featuresSubtitle')}</p>
          
          <div className="features-grid fade-in">
            <div className="feature-card">
              <div className="feature-icon">
                <i className="fa-solid fa-file"></i>
              </div>
              <h3>{t('landing.feature1Title')}</h3>
              <p>{t('landing.feature1Desc')}</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <i className="fa-solid fa-robot"></i>
              </div>
              <h3>{t('landing.feature2Title')}</h3>
              <p>{t('landing.feature2Desc')}</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <i className="fa-solid fa-share-nodes"></i>
              </div>
              <h3>{t('landing.feature3Title')}</h3>
              <p>{t('landing.feature3Desc')}</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <i className="fa-solid fa-globe"></i>
              </div>
              <h3>{t('landing.feature4Title')}</h3>
              <p>{t('landing.feature4Desc')}</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <i className="fa-solid fa-chart-line"></i>
              </div>
              <h3>{t('landing.feature5Title')}</h3>
              <p>{t('landing.feature5Desc')}</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <i className="fa-solid fa-lock"></i>
              </div>
              <h3>{t('landing.feature6Title')}</h3>
              <p>{t('landing.feature6Desc')}</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <i className="fa-solid fa-bolt"></i>
              </div>
              <h3>{t('landing.feature7Title')}</h3>
              <p>{t('landing.feature7Desc')}</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <i className="fa-solid fa-lightbulb"></i>
              </div>
              <h3>{t('landing.feature8Title')}</h3>
              <p>{t('landing.feature8Desc')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section - 1.3.51 moved after Features */}
      <section id="cases" className="section testimonials-section">
        <div className="landing-container">
          <h2 className="section-title">{t('landing.casesTitle')}</h2>
          <p className="section-subtitle">{t('landing.casesSubtitle')}</p>
          
          <div className="testimonial-cards fade-in">
            <div className="testimonial-card">
              <div className="testimonial-quote">
                "{t('landing.case1Quote')}"
              </div>
              <div className="testimonial-author">
                <div>
                  <div className="testimonial-company">{t('landing.case1Company')}</div>
                  <div className="testimonial-role">{t('landing.case1Scale')}</div>
                </div>
              </div>
              <div className="testimonial-stats">
                <div className="stat-badge">{t('landing.case1Stat1')}</div>
                <div className="stat-badge">{t('landing.case1Stat2')}</div>
              </div>
            </div>

            <div className="testimonial-card">
              <div className="testimonial-quote">
                "{t('landing.case2Quote')}"
              </div>
              <div className="testimonial-author">
                <div>
                  <div className="testimonial-company">{t('landing.case2Company')}</div>
                  <div className="testimonial-role">{t('landing.case2Scale')}</div>
                </div>
              </div>
              <div className="testimonial-stats">
                <div className="stat-badge">{t('landing.case2Stat1')}</div>
                <div className="stat-badge">{t('landing.case2Stat2')}</div>
              </div>
            </div>

            <div className="testimonial-card">
              <div className="testimonial-quote">
                "{t('landing.case3Quote')}"
              </div>
              <div className="testimonial-author">
                <div>
                  <div className="testimonial-company">{t('landing.case3Company')}</div>
                  <div className="testimonial-role">{t('landing.case3Scale')}</div>
                </div>
              </div>
              <div className="testimonial-stats">
                <div className="stat-badge">{t('landing.case3Stat1')}</div>
                <div className="stat-badge">{t('landing.case3Stat2')}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="section pricing-section">
        <div className="landing-container">
          <h2 className="section-title">{t('landing.pricingTitle')}</h2>
          <p className="section-subtitle">{t('landing.pricingSubtitle')}</p>
          
          <div className="pricing-cards-3 fade-in">
            {/* Individual */}
            <div className="pricing-card">
              <div className="pricing-type-badge individual">{t('landing.pricingTypeIndividual')}</div>
              <div className="pricing-header">
                <h3>Individual</h3>
                <p className="pricing-users">{t('landing.pricingIndividualUsers')}</p>
              </div>
              <div className="pricing-price">
                <span className="price-amount">¥2,500</span>
                <span className="price-period">/{t('landing.pricingPerPerson')}</span>
              </div>
              <ul className="pricing-features">
                <li><i className="fa-solid fa-check"></i> {t('landing.pricingUnlimitedChat')}</li>
                <li><i className="fa-solid fa-check"></i> {t('landing.pricingPublicLink')} 5,000{t('landing.pricingTimesMonth')}</li>
                <li><i className="fa-solid fa-check"></i> {t('landing.pricingUnlimitedKB')}</li>
                <li><i className="fa-solid fa-check"></i> {t('landing.pricingStorage')} 1GB/{t('landing.pricingPerson')}</li>
                <li className="feature-disabled"><i className="fa-solid fa-xmark"></i> {t('landing.pricingMultiUser')}</li>
                <li className="feature-disabled"><i className="fa-solid fa-xmark"></i> {t('landing.pricingSharedKB')}</li>
              </ul>
              <p className="pricing-overage">{t('landing.pricingOverage')}</p>
            </div>

            {/* Standard - Popular */}
            <div className="pricing-card popular">
              <div className="popular-badge">{t('landing.pricingPopular')}</div>
              <div className="pricing-type-badge enterprise">{t('landing.pricingTypeEnterprise')}</div>
              <div className="pricing-header">
                <h3>Standard</h3>
                <p className="pricing-users">{t('landing.pricingStandardUsers')}</p>
              </div>
              <div className="pricing-price">
                <span className="price-amount">¥2,300</span>
                <span className="price-period">/{t('landing.pricingPerPerson')}</span>
              </div>
              <ul className="pricing-features">
                <li><i className="fa-solid fa-check"></i> {t('landing.pricingUnlimitedChat')}</li>
                <li><i className="fa-solid fa-check"></i> {t('landing.pricingPublicLink')} 10,000{t('landing.pricingTimesMonth')}</li>
                <li><i className="fa-solid fa-check"></i> {t('landing.pricingUnlimitedKB')}</li>
                <li><i className="fa-solid fa-check"></i> {t('landing.pricingStorage')} 10GB</li>
                <li><i className="fa-solid fa-check"></i> {t('landing.pricingMultiUser')}</li>
                <li><i className="fa-solid fa-check"></i> {t('landing.pricingSharedKB')}</li>
                <li><i className="fa-solid fa-check"></i> {t('landing.pricingRoleOwnerMember')}</li>
              </ul>
              <p className="pricing-overage">{t('landing.pricingOverage')}</p>
            </div>

            {/* Enterprise */}
            <div className="pricing-card enterprise-card">
              <div className="pricing-type-badge enterprise">{t('landing.pricingTypeEnterprise')}</div>
              <div className="pricing-header">
                <h3>Enterprise</h3>
                <p className="pricing-users">{t('landing.pricingEnterpriseUsers')}</p>
              </div>
              <div className="pricing-price">
                <span className="price-amount-contact">{t('landing.pricingContactUs')}</span>
              </div>
              <ul className="pricing-features">
                <li><i className="fa-solid fa-check"></i> {t('landing.pricingUnlimitedChat')}</li>
                <li><i className="fa-solid fa-check"></i> {t('landing.pricingPublicLink')} {t('landing.pricingCustom')}</li>
                <li><i className="fa-solid fa-check"></i> {t('landing.pricingUnlimitedKB')}</li>
                <li><i className="fa-solid fa-check"></i> {t('landing.pricingStorage')} {t('landing.pricingCustom')}</li>
                <li><i className="fa-solid fa-check"></i> {t('landing.pricingAllStandardFeatures')}</li>
                <li><i className="fa-solid fa-check"></i> {t('landing.pricingDedicatedSupport')}</li>
              </ul>
            </div>
          </div>

          {/* Feature Comparison */}
          <div className="pricing-comparison fade-in">
            <h3 className="comparison-title">{t('landing.pricingFeatureComparison')}</h3>
            <div className="comparison-table">
              <div className="comparison-header">
                <div className="comparison-feature">{t('landing.pricingFeature')}</div>
                <div className="comparison-plan">Individual</div>
                <div className="comparison-plan">Standard</div>
              </div>
              <div className="comparison-section-title">{t('landing.pricingAccountManagement')}</div>
              <div className="comparison-row">
                <div className="comparison-feature">{t('landing.pricingMultiUser')}</div>
                <div className="comparison-value"><i className="fa-solid fa-xmark disabled"></i></div>
                <div className="comparison-value"><i className="fa-solid fa-check"></i></div>
              </div>
              <div className="comparison-row">
                <div className="comparison-feature">{t('landing.pricingInviteMembers')}</div>
                <div className="comparison-value"><i className="fa-solid fa-xmark disabled"></i></div>
                <div className="comparison-value"><i className="fa-solid fa-check"></i></div>
              </div>
              <div className="comparison-section-title">{t('landing.pricingKnowledgeBase')}</div>
              <div className="comparison-row">
                <div className="comparison-feature">{t('landing.pricingPersonalKB')}</div>
                <div className="comparison-value"><i className="fa-solid fa-check"></i></div>
                <div className="comparison-value"><i className="fa-solid fa-check"></i></div>
              </div>
              <div className="comparison-row">
                <div className="comparison-feature">{t('landing.pricingSharedKB')}</div>
                <div className="comparison-value"><i className="fa-solid fa-xmark disabled"></i></div>
                <div className="comparison-value"><i className="fa-solid fa-check"></i></div>
              </div>
              <div className="comparison-section-title">{t('landing.pricingRolePermission')}</div>
              <div className="comparison-row">
                <div className="comparison-feature">Owner ({t('landing.pricingRoleOwner')})</div>
                <div className="comparison-value">—</div>
                <div className="comparison-value"><i className="fa-solid fa-check"></i></div>
              </div>
              <div className="comparison-row">
                <div className="comparison-feature">Member ({t('landing.pricingRoleMember')})</div>
                <div className="comparison-value">—</div>
                <div className="comparison-value"><i className="fa-solid fa-check"></i></div>
              </div>
            </div>
          </div>

          <p className="pricing-note">{t('landing.pricingNote')}</p>
        </div>
      </section>

      {/* Final CTA Section */}
      <section id="cta" className="section cta-section">
        <div className="landing-container">
          <h2 className="section-title">{t('landing.ctaTitle')}</h2>
          <p className="cta-subtitle">{t('landing.ctaSubtitle')}</p>
          
          <div className="cta-highlights">
            <div className="cta-highlight">
              <span className="cta-highlight-number">¥1.5{t('landing.tenThousand')}/{t('landing.month')}</span>
              <span className="cta-highlight-label">{t('landing.ctaLowCost')}</span>
            </div>
            <div className="cta-highlight">
              <span className="cta-highlight-number">2.25{t('landing.days')}</span>
              <span className="cta-highlight-label">{t('landing.ctaQuickPayback')}</span>
            </div>
            <div className="cta-highlight">
              <span className="cta-highlight-number">{t('landing.ctaSave240')}</span>
              <span className="cta-highlight-label">{t('landing.ctaCostReduction')}</span>
            </div>
            <div className="cta-highlight">
              <span className="cta-highlight-number">{t('landing.ctaZeroTech')}</span>
              <span className="cta-highlight-label">{t('landing.ctaQuickDeploy')}</span>
            </div>
          </div>

          <div className="cta-buttons">
            <button onClick={handleCTA} className="btn btn-primary cta-btn">
              <i className="fa-solid fa-rocket"></i> {t('landing.tryFree14Days')}
            </button>
          </div>

          <div className="trust-badges">
            <div className="trust-badge">
              <i className="fa-solid fa-shield-halved"></i>
              <span>{t('landing.trustSecurity')}</span>
            </div>
            <div className="trust-badge">
              <i className="fa-solid fa-cloud"></i>
              <span>{t('landing.trustPrivate')}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="footer">
        <div className="landing-container">
          <div className="footer-content">
            <div className="footer-brand-section">
              <div className="footer-brand">
                <img 
                  src="/logo.svg" 
                  alt="YUIChat Logo" 
                  className="footer-logo-img"
                  onError={(e) => {
                    // 如果SVG加载失败，尝试PNG
                    const target = e.target as HTMLImageElement;
                    if (target.src.endsWith('.svg')) {
                      target.src = '/logo.png';
                    }
                  }}
                />
              </div>
              <p className="footer-desc">{t('landing.footerDesc')}</p>
            </div>

            <div className="footer-section">
              <h4>{t('landing.footerProduct')}</h4>
              <ul className="footer-links">
                <li><a href="#solution" onClick={(e) => { e.preventDefault(); scrollToSection('solution'); }}>{t('landing.footerSolution')}</a></li>
                <li><a href="#features" onClick={(e) => { e.preventDefault(); scrollToSection('features'); }}>{t('landing.footerFeatures')}</a></li>
                <li><a href="#cases" onClick={(e) => { e.preventDefault(); scrollToSection('cases'); }}>{t('landing.footerCases')}</a></li>
                <li><a href="#pricing" onClick={(e) => { e.preventDefault(); scrollToSection('pricing'); }}>{t('landing.footerPricing')}</a></li>
              </ul>
            </div>

            <div className="footer-section">
              <h4>{t('landing.footerContact')}</h4>
              <ul className="footer-links">
                <li><i className="fa-solid fa-envelope"></i> contact@yuichat.app</li>
                <li><i className="fa-solid fa-phone"></i> 080-4441-3968</li>
                <li><i className="fa-solid fa-location-dot"></i> {t('landing.footerLocation')}</li>
              </ul>
            </div>
          </div>

          <div className="footer-bottom">
            <p>&copy; 2026 YUIChat. All Rights Reserved. | <a href="#">{t('landing.footerPrivacy')}</a> | <a href="#">{t('landing.footerTerms')}</a></p>
          </div>
        </div>
      </footer>

      {/* 落地页专用样式 */}
      <style>{`
        .landing-page {
          font-family: 'Noto Sans SC', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', -apple-system, BlinkMacSystemFont, sans-serif;
          line-height: 1.6;
          color: #111827;
          overflow-x: hidden;
          font-weight: 400;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        .landing-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 20px;
        }

        .section {
          padding: 100px 0;
          position: relative;
        }

        .section-title {
          font-size: 48px;
          font-weight: 900;
          text-align: center;
          margin-bottom: 20px;
          color: #111827;
        }

        .section-subtitle {
          font-size: 20px;
          text-align: center;
          color: #6B7280;
          margin-bottom: 60px;
          max-width: 800px;
          margin-left: auto;
          margin-right: auto;
        }

        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 16px 40px;
          border-radius: 12px;
          font-size: 18px;
          font-weight: 700;
          text-decoration: none;
          transition: all 0.3s ease;
          cursor: pointer;
          border: none;
        }

        .btn-primary {
          background: linear-gradient(135deg, #8B5CF6, #6D28D9);
          color: white;
          box-shadow: 0 8px 20px rgba(139, 92, 246, 0.3);
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 28px rgba(139, 92, 246, 0.4);
        }

        .btn-secondary {
          background: white;
          color: #8B5CF6;
          border: 2px solid #8B5CF6;
        }

        .btn-secondary:hover {
          background: #8B5CF6;
          color: white;
        }

        /* 导航栏 */
        .landing-navbar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          z-index: 1000;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          transition: all 0.3s ease;
        }

        .landing-navbar.scrolled {
          background: rgba(255, 255, 255, 0.98);
          box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        }

        .navbar-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
        }

        .logo {
          text-decoration: none;
          display: flex;
          align-items: center;
          height: 40px;
        }

        .logo-img {
          height: 100%;
          width: auto;
          object-fit: contain;
        }

        .nav-menu {
          display: flex;
          list-style: none;
          gap: 32px;
          align-items: center;
          margin: 0;
          padding: 0;
        }

        .nav-menu a {
          color: #111827;
          text-decoration: none;
          font-weight: 500;
          transition: color 0.3s;
        }

        .nav-menu a:hover {
          color: #8B5CF6;
        }

        .nav-cta {
          padding: 10px 24px !important;
          font-size: 16px !important;
        }

        /* Hero Section */
        .hero {
          min-height: 100vh;
          display: flex;
          align-items: center;
          background-color: #4C1D95;
          position: relative;
          overflow: hidden;
          padding-top: 80px;
          padding-bottom: 60px;
        }

        /* Background gradient shapes */
        .hero-bg-shape-1 {
          position: absolute;
          top: -100px;
          left: -100px;
          width: 600px;
          height: 600px;
          background-color: #6D28D9;
          border-radius: 50%;
          opacity: 0.5;
          filter: blur(80px);
          z-index: 1;
        }

        .hero-bg-shape-2 {
          position: absolute;
          bottom: -150px;
          right: -50px;
          width: 700px;
          height: 700px;
          background-color: #7C3AED;
          border-radius: 50%;
          opacity: 0.4;
          filter: blur(100px);
          z-index: 1;
        }

        .hero-bg-pattern {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
          z-index: 2;
        }

        .hero-content {
          position: relative;
          z-index: 10;
          text-align: center;
          color: white;
          width: 100%;
        }

        .hero-title {
          font-size: 80px;
          font-weight: 900;
          margin-bottom: 32px;
          line-height: 1.15;
          text-shadow: 0 6px 30px rgba(0,0,0,0.3);
          letter-spacing: -2px;
        }

        .hero-title .highlight {
          color: #FCD34D;
          position: relative;
          display: inline-block;
        }

        .hero-title .highlight::after {
          content: '';
          position: absolute;
          bottom: 8px;
          left: 0;
          width: 100%;
          height: 12px;
          background-color: rgba(252, 211, 77, 0.3);
          z-index: -1;
        }

        .hero-subtitle-card {
          display: inline-block;
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          padding: 20px 48px;
          border-radius: 20px;
          margin-bottom: 50px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
        }

        .hero-subtitle {
          font-size: 28px;
          font-weight: 700;
          margin: 0;
          letter-spacing: 1px;
        }

        .hero-subtitle .number {
          color: #FCD34D;
          font-size: 36px;
        }

        .hero-subtitle .divider {
          margin: 0 20px;
          color: #A78BFA;
        }

        /* Value Cards */
        .hero-value-cards {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
          max-width: 900px;
          margin: 0 auto 50px;
        }

        .hero-value-card {
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 16px;
          padding: 32px 24px;
          text-align: center;
          transition: all 0.3s ease;
        }

        .hero-value-card:hover {
          background: rgba(255, 255, 255, 0.15);
          transform: translateY(-5px);
        }

        .hero-value-icon {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px;
          font-size: 24px;
          color: white;
          box-shadow: inset 0 2px 10px rgba(0, 0, 0, 0.2);
        }

        .hero-value-icon.purple {
          background: rgba(139, 92, 246, 0.5);
        }

        .hero-value-icon.pink {
          background: rgba(236, 72, 153, 0.5);
        }

        .hero-value-icon.indigo {
          background: rgba(99, 102, 241, 0.5);
        }

        .hero-value-card h3 {
          font-size: 18px;
          font-weight: 700;
          margin-bottom: 12px;
          color: white;
        }

        .hero-value-card p {
          font-size: 14px;
          color: rgba(233, 213, 255, 0.9);
          line-height: 1.6;
          margin: 0;
        }

        .hero-cta {
          display: flex;
          justify-content: center;
          gap: 20px;
          margin-top: 20px;
          flex-wrap: wrap;
        }

        .hero-btn {
          font-size: 20px !important;
          padding: 18px 44px !important;
          border-radius: 14px !important;
        }

        .hero-btn.btn-secondary {
          background: white;
          color: #6D28D9;
          border: none;
        }

        .hero-btn.btn-secondary:hover {
          background: #F3F4F6;
          color: #6D28D9;
        }

        /* Problem Section */
        .problem-section {
          background: #F9FAFB;
        }

        .problem-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
          gap: 40px;
          margin-top: 60px;
        }

        .problem-card {
          background: white;
          border-radius: 20px;
          padding: 40px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.08);
          transition: all 0.3s ease;
        }

        .problem-card:hover {
          transform: translateY(-10px);
          box-shadow: 0 12px 40px rgba(139, 92, 246, 0.15);
        }

        .problem-card-header {
          display: flex;
          align-items: center;
          gap: 20px;
          margin-bottom: 24px;
        }

        .problem-icon {
          width: 64px;
          height: 64px;
          background: linear-gradient(135deg, #8B5CF6, #6D28D9);
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          color: white;
          flex-shrink: 0;
        }

        .problem-stat {
          display: flex;
          flex-direction: column;
        }

        .problem-stat .stat-number {
          font-size: 32px;
          font-weight: 800;
          color: #8B5CF6;
          line-height: 1.1;
        }

        .problem-stat .stat-number .stat-unit {
          font-size: 20px;
          font-weight: 600;
        }

        .problem-stat .stat-label {
          font-size: 13px;
          color: #9CA3AF;
          font-weight: 500;
          margin-top: 2px;
        }

        .problem-card h3 {
          font-size: 24px;
          font-weight: 800;
          margin-bottom: 12px;
          color: #111827;
        }

        .problem-card p {
          font-size: 16px;
          color: #6B7280;
          line-height: 1.7;
        }

        /* Solution Section */
        .solution-section {
          background: #F9FAFB;
          position: relative;
          overflow: hidden;
          padding: 100px 0;
        }

        .solution-content {
          position: relative;
          z-index: 10;
        }

        .solution-header {
          text-align: center;
          margin-bottom: 60px;
        }

        .solution-title {
          font-size: 48px;
          font-weight: 900;
          color: #111827;
          line-height: 1.3;
          margin: 0;
        }

        .solution-title .highlight {
          color: #8B5CF6;
        }

        .solution-cards {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 32px;
        }

        .solution-card {
          background: white;
          border-radius: 20px;
          padding: 40px 32px;
          text-align: center;
          position: relative;
          overflow: hidden;
          transition: all 0.3s ease;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
        }

        .solution-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 15px 40px rgba(139, 92, 246, 0.15);
        }

        .card-number {
          font-size: 64px;
          font-weight: 900;
          position: absolute;
          top: 10px;
          right: 20px;
          color: rgba(139, 92, 246, 0.08);
          z-index: 1;
        }

        .solution-icon {
          width: 72px;
          height: 72px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          margin: 0 0 24px 0;
          position: relative;
          z-index: 2;
          transition: all 0.3s ease;
        }

        .solution-icon.pink {
          background: linear-gradient(135deg, #8B5CF6, #6D28D9);
          color: white;
        }

        .solution-icon.blue {
          background: linear-gradient(135deg, #8B5CF6, #6D28D9);
          color: white;
        }

        .solution-icon.green {
          background: linear-gradient(135deg, #8B5CF6, #6D28D9);
          color: white;
        }

        .solution-card:hover .solution-icon {
          transform: scale(1.1);
        }

        .solution-card h3 {
          font-size: 24px;
          font-weight: 800;
          color: #111827;
          margin-bottom: 8px;
          text-align: left;
        }

        .solution-subtitle {
          display: block;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 2px;
          margin-bottom: 16px;
          color: #9CA3AF;
          text-align: left;
        }

        .solution-card p {
          font-size: 16px;
          color: #6B7280;
          line-height: 1.7;
          margin: 0;
          text-align: left;
        }

        .solution-card p .number {
          color: #8B5CF6;
          font-size: 20px;
          font-weight: 700;
        }

        /* Comparison Section */
        .comparison-section {
          background: #F9FAFB;
        }

        .comparison-container {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          gap: 40px;
          align-items: center;
          margin-top: 60px;
        }

        .comparison-card {
          background: white;
          border-radius: 20px;
          padding: 40px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.08);
          transition: all 0.3s ease;
        }

        .comparison-card:hover {
          transform: translateY(-10px);
          box-shadow: 0 12px 40px rgba(139, 92, 246, 0.15);
        }

        .comparison-card-header {
          display: flex;
          align-items: center;
          gap: 20px;
          margin-bottom: 24px;
        }

        .comparison-icon {
          width: 64px;
          height: 64px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          color: white;
          flex-shrink: 0;
        }

        .comparison-icon.old {
          background: linear-gradient(135deg, #EF4444, #DC2626);
        }

        .comparison-icon.new {
          background: linear-gradient(135deg, #8B5CF6, #6D28D9);
        }

        .comparison-stat .stat-number {
          font-size: 32px;
          font-weight: 800;
          line-height: 1.1;
        }

        .comparison-stat .stat-number.old {
          color: #EF4444;
        }

        .comparison-stat .stat-number.new {
          color: #8B5CF6;
        }

        .comparison-stat .stat-number .stat-unit {
          font-size: 20px;
          font-weight: 600;
        }

        .comparison-stat .stat-label {
          display: block;
          font-size: 13px;
          color: #9CA3AF;
          font-weight: 500;
          margin-top: 2px;
        }

        .comparison-card h3 {
          font-size: 24px;
          font-weight: 800;
          margin-bottom: 12px;
          color: #111827;
        }

        .comparison-card p {
          font-size: 16px;
          color: #6B7280;
          line-height: 1.7;
        }

        .comparison-divider {
          text-align: center;
          font-size: 48px;
          color: #8B5CF6;
        }

        .savings-highlight {
          text-align: center;
          margin-top: 40px;
          padding: 30px;
          background: linear-gradient(135deg, #8B5CF6, #6D28D9);
          border-radius: 20px;
          color: white;
        }

        .savings-highlight p {
          font-size: 20px;
          margin-bottom: 12px;
        }

        .savings-highlight .amount {
          font-size: 56px;
          font-weight: 900;
        }

        /* Steps Section */
        .steps-section {
          background: #F9FAFB;
        }

        .steps-container {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 40px;
          margin-top: 60px;
        }

        .step-card {
          background: white;
          border-radius: 20px;
          padding: 40px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.08);
          transition: all 0.3s ease;
        }

        .step-card:hover {
          transform: translateY(-10px);
          box-shadow: 0 12px 40px rgba(139, 92, 246, 0.15);
        }

        .step-card-header {
          display: flex;
          align-items: center;
          gap: 20px;
          margin-bottom: 24px;
        }

        .step-icon {
          width: 64px;
          height: 64px;
          background: linear-gradient(135deg, #8B5CF6, #6D28D9);
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          color: white;
          flex-shrink: 0;
        }

        .step-stat .stat-number {
          display: block;
          font-size: 32px;
          font-weight: 800;
          color: #8B5CF6;
          line-height: 1.1;
        }

        .step-stat .stat-label {
          display: block;
          font-size: 18px;
          color: #111827;
          font-weight: 700;
          margin-top: 4px;
        }

        .step-card p {
          font-size: 16px;
          color: #6B7280;
          line-height: 1.7;
          margin: 0;
        }

        .steps-emphasis-cards {
          display: flex;
          justify-content: center;
          gap: 40px;
          margin-top: 60px;
        }

        .emphasis-card {
          background: white;
          border-radius: 16px;
          padding: 32px 48px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.08);
          display: flex;
          align-items: center;
          gap: 16px;
          transition: all 0.3s ease;
        }

        .emphasis-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 12px 40px rgba(139, 92, 246, 0.15);
        }

        .emphasis-card i {
          font-size: 32px;
          color: #8B5CF6;
        }

        .emphasis-card span {
          font-size: 24px;
          font-weight: 800;
          color: #111827;
        }

        /* Efficiency Section */
        .efficiency-section {
          background: linear-gradient(135deg, #4C1D95 0%, #6D28D9 100%);
          color: white;
        }

        .efficiency-section .section-title {
          color: white;
        }

        .efficiency-section .section-subtitle {
          color: rgba(255, 255, 255, 0.8);
        }

        .efficiency-cards {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 30px;
        }

        .efficiency-card {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 24px;
          padding: 40px;
          text-align: center;
          transition: all 0.3s ease;
        }

        .efficiency-card:hover {
          background: rgba(255, 255, 255, 0.08);
          transform: translateY(-10px);
        }

        .efficiency-card h3 {
          margin: 20px 0;
          font-size: 20px;
        }

        .efficiency-icon {
          width: 80px;
          height: 80px;
          margin: 0 auto;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 36px;
        }

        .efficiency-icon.pink {
          background: linear-gradient(135deg, #EC4899, #DB2777);
        }

        .efficiency-icon.blue {
          background: linear-gradient(135deg, #3B82F6, #2563EB);
        }

        .efficiency-icon.green {
          background: linear-gradient(135deg, #10B981, #059669);
        }

        .before-value {
          background: rgba(0, 0, 0, 0.2);
          padding: 12px 20px;
          border-radius: 12px;
          margin-bottom: 20px;
          font-size: 16px;
          opacity: 0.8;
        }

        .after-value {
          font-size: 72px;
          font-weight: 900;
          margin: 20px 0;
          text-shadow: 0 4px 10px rgba(0,0,0,0.3);
        }

        .improvement-tag {
          background: rgba(255, 255, 255, 0.15);
          padding: 8px 20px;
          border-radius: 50px;
          font-size: 14px;
          font-weight: 700;
          display: inline-block;
        }

        /* Testimonials Section */
        .testimonials-section {
          background: white;
        }

        .testimonial-cards {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 40px;
          margin-top: 60px;
        }

        .testimonial-card {
          background: #F9FAFB;
          border-radius: 24px;
          padding: 40px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.06);
          transition: all 0.3s ease;
        }

        .testimonial-card:hover {
          box-shadow: 0 12px 40px rgba(139, 92, 246, 0.15);
          transform: translateY(-5px);
        }

        .testimonial-quote {
          font-size: 18px;
          line-height: 1.8;
          color: #111827;
          margin-bottom: 24px;
          font-style: italic;
        }

        .testimonial-author {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid #E5E7EB;
        }

        .testimonial-company {
          font-weight: 700;
          color: #8B5CF6;
        }

        .testimonial-role {
          font-size: 14px;
          color: #6B7280;
        }

        .testimonial-stats {
          display: flex;
          gap: 20px;
          margin-top: 20px;
          flex-wrap: wrap;
        }

        .stat-badge {
          background: #8B5CF6;
          color: white;
          padding: 8px 16px;
          border-radius: 50px;
          font-size: 14px;
          font-weight: 700;
        }

        /* Pricing Section */
        .pricing-section {
          background: linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%);
        }

        .pricing-cards-3 {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 32px;
          margin-top: 60px;
          max-width: 1100px;
          margin-left: auto;
          margin-right: auto;
        }

        .pricing-card {
          background: white;
          border-radius: 20px;
          padding: 32px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.08);
          transition: all 0.3s ease;
          position: relative;
          display: flex;
          flex-direction: column;
        }

        .pricing-card:hover {
          transform: translateY(-10px);
          box-shadow: 0 12px 40px rgba(139, 92, 246, 0.2);
        }

        .pricing-card.popular {
          border: 2px solid #8B5CF6;
          transform: scale(1.05);
        }

        .pricing-card.popular:hover {
          transform: scale(1.05) translateY(-10px);
        }

        .pricing-type-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 50px;
          font-size: 11px;
          font-weight: 700;
          margin-bottom: 12px;
        }

        .pricing-type-badge.individual {
          background: #E0E7FF;
          color: #4F46E5;
        }

        .pricing-type-badge.enterprise {
          background: #F3E8FF;
          color: #7C3AED;
        }

        .popular-badge {
          position: absolute;
          top: -12px;
          left: 50%;
          transform: translateX(-50%);
          background: linear-gradient(135deg, #8B5CF6, #6D28D9);
          color: white;
          padding: 6px 20px;
          border-radius: 50px;
          font-size: 12px;
          font-weight: 700;
        }

        .pricing-header h3 {
          font-size: 24px;
          font-weight: 800;
          color: #111827;
          margin-bottom: 4px;
        }

        .pricing-users {
          font-size: 14px;
          color: #6B7280;
          margin: 0;
        }

        .pricing-price {
          margin: 24px 0;
          padding: 16px 0;
          border-top: 1px solid #E5E7EB;
          border-bottom: 1px solid #E5E7EB;
        }

        .price-amount {
          font-size: 36px;
          font-weight: 900;
          color: #8B5CF6;
        }

        .price-amount-contact {
          font-size: 28px;
          font-weight: 800;
          color: #8B5CF6;
        }

        .price-period {
          font-size: 16px;
          color: #6B7280;
        }

        .pricing-features {
          list-style: none;
          padding: 0;
          margin: 0 0 20px 0;
          flex-grow: 1;
        }

        .pricing-features li {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 12px;
          font-size: 14px;
          color: #374151;
        }

        .pricing-features li i {
          color: #8B5CF6;
          font-size: 12px;
        }

        .pricing-features li.feature-disabled {
          color: #9CA3AF;
        }

        .pricing-features li.feature-disabled i {
          color: #D1D5DB;
        }

        /* Feature Comparison Table */
        .pricing-comparison {
          margin-top: 80px;
          max-width: 800px;
          margin-left: auto;
          margin-right: auto;
        }

        .comparison-title {
          text-align: center;
          font-size: 28px;
          font-weight: 800;
          color: #111827;
          margin-bottom: 32px;
        }

        .comparison-table {
          background: white;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0,0,0,0.08);
        }

        .comparison-header {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr;
          background: #F9FAFB;
          padding: 16px 24px;
          font-weight: 700;
          color: #374151;
        }

        .comparison-section-title {
          background: #F3F4F6;
          padding: 12px 24px;
          font-weight: 700;
          color: #6B7280;
          font-size: 13px;
        }

        .comparison-row {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr;
          padding: 14px 24px;
          border-bottom: 1px solid #E5E7EB;
        }

        .comparison-row:last-child {
          border-bottom: none;
        }

        .comparison-feature {
          color: #374151;
          font-size: 14px;
        }

        .comparison-value {
          text-align: center;
          font-size: 14px;
        }

        .comparison-value i.fa-check {
          color: #8B5CF6;
        }

        .comparison-value i.disabled {
          color: #D1D5DB;
        }

        .comparison-plan {
          text-align: center;
          font-weight: 700;
        }

        .pricing-overage {
          font-size: 12px;
          color: #9CA3AF;
          margin: 0;
          padding-top: 16px;
          border-top: 1px solid #E5E7EB;
        }

        .pricing-note {
          text-align: center;
          margin-top: 40px;
          color: #6B7280;
          font-size: 14px;
        }

        /* Features Grid */
        .features-section {
          background: #F9FAFB;
        }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 30px;
          margin-top: 60px;
        }

        .feature-card {
          background: white;
          border-radius: 20px;
          padding: 30px;
          text-align: center;
          box-shadow: 0 2px 10px rgba(0,0,0,0.05);
          transition: all 0.3s ease;
        }

        .feature-card:hover {
          box-shadow: 0 8px 30px rgba(139, 92, 246, 0.2);
          transform: translateY(-5px);
        }

        .feature-icon {
          width: 60px;
          height: 60px;
          background: linear-gradient(135deg, #8B5CF6, #6D28D9);
          color: white;
          font-size: 28px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
        }

        .feature-card h3 {
          font-size: 18px;
          font-weight: 700;
          margin-bottom: 12px;
          color: #111827;
        }

        .feature-card p {
          font-size: 14px;
          color: #6B7280;
        }

        /* CTA Section */
        .cta-section {
          background: linear-gradient(135deg, #6D28D9 0%, #8B5CF6 100%);
          color: white;
          text-align: center;
          padding: 120px 0;
        }

        .cta-section .section-title {
          color: white;
          font-size: 56px;
        }

        .cta-subtitle {
          font-size: 24px;
          margin-bottom: 40px;
          opacity: 0.9;
        }

        .cta-highlights {
          display: flex;
          justify-content: center;
          gap: 60px;
          margin: 50px 0;
          flex-wrap: wrap;
        }

        .cta-highlight {
          text-align: center;
        }

        .cta-highlight-number {
          font-size: 48px;
          font-weight: 900;
          display: block;
          margin-bottom: 8px;
        }

        .cta-highlight-label {
          font-size: 16px;
          opacity: 0.9;
        }

        .cta-buttons {
          display: flex;
          justify-content: center;
          gap: 20px;
          margin-top: 50px;
          flex-wrap: wrap;
        }

        .cta-btn {
          font-size: 20px !important;
          padding: 20px 50px !important;
        }

        .cta-btn.btn-primary {
          background: white;
          color: #8B5CF6;
        }

        .cta-btn.btn-secondary {
          border-color: white;
          color: white;
        }

        .trust-badges {
          display: flex;
          justify-content: center;
          gap: 40px;
          margin-top: 50px;
          opacity: 0.9;
          flex-wrap: wrap;
        }

        .trust-badge {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 16px;
        }

        /* Footer */
        .footer {
          background: #111827;
          color: white;
          padding: 60px 0 30px;
        }

        .footer-content {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr;
          gap: 60px;
          margin-bottom: 40px;
        }

        .footer-brand {
          margin-bottom: 20px;
          height: 44px;
        }

        .footer-logo-img {
          height: 100%;
          width: auto;
          object-fit: contain;
          filter: brightness(0) invert(1);
        }

        .footer-desc {
          font-size: 16px;
          line-height: 1.8;
          opacity: 0.8;
        }

        .footer-section h4 {
          font-size: 18px;
          font-weight: 700;
          margin-bottom: 20px;
        }

        .footer-links {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .footer-links li {
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .footer-links a {
          color: rgba(255, 255, 255, 0.8);
          text-decoration: none;
          transition: color 0.3s;
        }

        .footer-links a:hover {
          color: #8B5CF6;
        }

        .footer-social {
          margin-top: 20px;
          display: flex;
          gap: 16px;
          font-size: 24px;
        }

        .footer-social a {
          color: rgba(255,255,255,0.6);
          transition: color 0.3s;
        }

        .footer-social a:hover {
          color: #8B5CF6;
        }

        .footer-bottom {
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          padding-top: 30px;
          text-align: center;
          opacity: 0.6;
          font-size: 14px;
        }

        .footer-bottom a {
          color: inherit;
          text-decoration: none;
        }

        .footer-bottom a:hover {
          color: #8B5CF6;
        }

        /* 滚动动画 */
        .fade-in {
          opacity: 0;
          transform: translateY(30px);
          transition: opacity 0.6s ease, transform 0.6s ease;
        }

        .fade-in.visible {
          opacity: 1;
          transform: translateY(0);
        }

        /* 响应式设计 */
        @media (max-width: 1024px) {
          .hero-title { font-size: 56px; }
          .section-title { font-size: 40px; }
          .solution-title { font-size: 36px; }
          .solution-cards { grid-template-columns: repeat(2, 1fr); }
          .hero-value-cards { grid-template-columns: repeat(2, 1fr); }
          .features-grid { grid-template-columns: repeat(2, 1fr); }
          .pricing-cards-3 { grid-template-columns: repeat(2, 1fr); }
          .pricing-card.popular { transform: scale(1); }
          .comparison-header, .comparison-row { grid-template-columns: 2fr 1fr 1fr; }
          .footer-content { grid-template-columns: 1fr 1fr; gap: 40px; }
        }

        @media (max-width: 768px) {
          .nav-menu { 
            display: none; 
          }
          .hero-title { font-size: 40px; }
          .hero-subtitle { font-size: 20px; }
          .hero-subtitle-card { padding: 16px 24px; }
          .hero-value-cards { grid-template-columns: 1fr; max-width: 400px; }
          .hero-btn { font-size: 18px !important; padding: 16px 32px !important; }
          .section-title { font-size: 32px; }
          .solution-title { font-size: 28px; }
          .solution-cards { grid-template-columns: 1fr; }
          .comparison-container { grid-template-columns: 1fr; }
          .comparison-divider { transform: rotate(90deg); margin: 20px 0; }
          .steps-container { grid-template-columns: 1fr; }
          .steps-emphasis-cards { flex-direction: column; align-items: center; gap: 20px; }
          .emphasis-card { padding: 24px 32px; }
          .emphasis-card span { font-size: 20px; }
          .efficiency-cards { grid-template-columns: 1fr; }
          .testimonial-cards { grid-template-columns: 1fr; }
          .features-grid { grid-template-columns: 1fr; }
          .pricing-cards-3 { grid-template-columns: 1fr; }
          .comparison-header, .comparison-row { font-size: 12px; }
          .footer-content { grid-template-columns: 1fr; }
          .cta-highlights { gap: 30px; }
          .cta-highlight-number { font-size: 36px; }
        }
      `}</style>
    </div>
  );
};
