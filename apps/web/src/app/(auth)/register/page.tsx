'use client';

import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import {
  Eye,
  EyeOff,
  Loader2,
  Check,
  ChevronRight,
  Facebook,
  Instagram,
  Linkedin,
  Twitter,
  Mail,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth.store';
import { CURRENCIES, COUNTRIES } from '@/types/constants';
import { slugify } from '@/lib/utils';

/* =========================================================
   SCHEMAS
========================================================= */

const schema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  username: z
    .string()
    .min(3)
    .regex(/^[a-z0-9_]+$/, 'Minuscules, chiffres et _ uniquement'),
  email: z.string().email('Email invalide'),
  password: z
    .string()
    .min(8)
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      '1 majuscule, 1 minuscule, 1 chiffre'
    ),
  storeName: z.string().min(2),
  storeSlug: z.string().min(3).regex(/^[a-z0-9-]+$/),
  currency: z.string().default('XOF'),
  country: z.string().default('SN'),
});

const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
});

type Form = z.infer<typeof schema>;
type LoginForm = z.infer<typeof loginSchema>;

/* =========================================================
   ANIMATION

   Le panneau vert est composé de DEUX moitiés indépendantes
   (haut / bas), chacune découpée par un clip-path polygon.
   Au lieu d'une simple diagonale droite, la bordure suit une
   courbe en trois points (bord / milieu / centre) : elle se
   RAPPROCHE du centre sur les bords haut/bas de la carte, et
   s'en ÉCARTE davantage à hauteur du texte (centre vertical),
   ce qui donne une vague organique tout en garantissant une
   marge de sécurité constante avec le contenu, quel que soit
   le mode.

        bord  ─╮
                ╲___ milieu
                     ╲___ centre (texte) → marge max
                     ╱
                ╱‾‾‾ milieu
        bord  ─╯

   Les 5 sommets de chaque moitié sont toujours dans le même
   ordre (coin1, coin2, courbe-bas, courbe-milieu, courbe-haut),
   ce qui garantit un morph image par image fluide entre les
   états (login ↔ plein ↔ signup), sans saut ni recalcul.
========================================================= */

type Side = 'login' | 'signup';

// Pourcentages de largeur (côté "login", droite) — mirorés pour signup.
// NB : plus la valeur est PETITE, plus la zone verte est GRANDE (elle part
// de "outer" 100%/0% et va jusqu'à cette valeur). Le texte du panneau vit
// à hauteur du centre vertical : c'est donc "center" qui doit être la plus
// petite valeur (= le plus de vert = la marge la plus large), pas l'inverse.
const CURVE = {
  edge: 72, // aux bords haut/bas de la carte (pas de contenu ici) → vague plus marquée
  mid: 65, // à mi-chemin entre le bord et le centre
  center: 53, // au centre vertical, où vit le texte → marge maximale, texte jamais coupé
};

const PANEL_EASE = [0.16, 1, 0.3, 1] as const; // expo-out, décélération nette et premium

const COVER_TRANSITION = { duration: 0.5, ease: PANEL_EASE };
const REFORM_TRANSITION = { type: 'spring', stiffness: 130, damping: 15, mass: 0.9 } as const;

const FULL_GREEN_PAUSE = 420; // pause où tout est vert (ms, hors Framer) — assez longue pour le flash lumineux
const FORM_EXIT_DURATION = 0.36;
const FORM_ENTER_DURATION = 0.55;
const FORM_EASE = [0.22, 1, 0.36, 1] as const;

/* =========================================================
   EFFET "PAPIER DÉCHIRÉ"

   Le panneau du formulaire est toujours découpé par le même
   clip-path à 16 sommets (haut/bas droits, bords gauche/droit
   en dents de scie). Au repos, les dents sont à 0%/100% donc
   invisibles (= rectangle parfait). Pendant l'animation, elles
   s'écartent : le bord devient déchiqueté pile au moment où le
   formulaire glisse et se floute, donnant l'impression qu'il
   se déchire en sortant / se reforme en entrant. Même nombre
   de sommets dans les deux états → morph fluide via Framer.

   IMPORTANT : ce clip-path est appliqué au wrapper qui ÉPOUSE
   le contenu visible (w-full max-w-xs), pas au conteneur de
   mise en page en pleine largeur. Sur le conteneur pleine
   largeur, les dents tombaient à 0%/100% de la carte entière,
   c'est-à-dire en plein dans le padding vide (px-8/md:px-14) :
   rien n'y est jamais dessiné, donc la déchirure ne se voyait
   jamais. En la déplaçant sur la boîte qui entoure réellement
   le texte et les champs, les dents mordent enfin sur du
   contenu visible.
========================================================= */

function tornClip(jitter: number) {
  const r = [0, 14, 28, 42, 57, 71, 85, 100].map((y, i) => {
    const off = i % 2 === 0 ? jitter : jitter * 0.6;
    return `${100 - off}% ${y}%`;
  });

  const l = [100, 85, 71, 57, 42, 28, 14, 0].map((y, i) => {
    const off = i % 2 === 0 ? jitter * 0.6 : jitter;
    return `${off}% ${y}%`;
  });

  return `polygon(${r.join(', ')}, ${l.join(', ')})`;
}

const FLAT_CLIP = tornClip(0); // rectangle intact, au repos
const TORN_CLIP = tornClip(11); // bords déchiquetés, pendant la transition (visible car sur la boîte de contenu)


function halfPolygon(mode: Side, half: 'top' | 'bottom', full: boolean) {
  const isRight = mode === 'login';
  const outer = isRight ? 100 : 0;
  const collapseX = isRight ? 0 : 100;
  const mirror = (x: number) => (isRight ? x : 100 - x);

  const edgeX = full ? collapseX : mirror(CURVE.edge);
  const midX = full ? collapseX : mirror(CURVE.mid);
  const centerX = full ? collapseX : mirror(CURVE.center);

  if (half === 'top') {
    // local y: 0% = haut de la carte, 100% = ligne centrale
    return `polygon(${outer}% 0%, ${outer}% 100%, ${centerX}% 100%, ${midX}% 50%, ${edgeX}% 0%)`;
  }

  // local y: 0% = ligne centrale, 100% = bas de la carte
  return `polygon(${outer}% 0%, ${outer}% 100%, ${edgeX}% 100%, ${midX}% 50%, ${centerX}% 0%)`;
}

/*
 * Machine à états — une seule direction possible à la fois :
 *
 *   idle
 *     → (clic) → formOut        [le formulaire sort]
 *     → (form sorti) → topCover     [le HAUT se referme sur tout vert]
 *     → (haut fermé) → bottomCover  [le BAS se referme à son tour]
 *     → (bas fermé)  → fullGreen    [pause : tout est vert, flash lumineux]
 *     → (pause finie) → reform      [haut + bas se reforment ENSEMBLE, en ressort]
 *     → (reform fini) → idle + le nouveau formulaire entre
 *
 * Chaque transition est déclenchée par la fin RÉELLE de l'étape
 * précédente (onAnimationComplete / onExitComplete), jamais par
 * un délai deviné.
 */

type Phase =
  | 'idle'
  | 'formOut'
  | 'topCover'
  | 'bottomCover'
  | 'fullGreen'
  | 'reform';

function topShapeFor(phase: Phase, mode: Side) {
  const full = phase === 'topCover' || phase === 'bottomCover' || phase === 'fullGreen';
  return halfPolygon(mode, 'top', full);
}

function bottomShapeFor(phase: Phase, mode: Side) {
  const full = phase === 'bottomCover' || phase === 'fullGreen';
  return halfPolygon(mode, 'bottom', full);
}

/* =========================================================
   VARIANTS — entrée en cascade des champs
========================================================= */

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};

const field: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: FORM_EASE } },
};

/* =========================================================
   PAGE
========================================================= */

export default function RegisterPage() {
  const router = useRouter();

  const { register: authRegister, login: authLogin } = useAuthStore();

  const [mode, setMode] = useState<Side>('signup');

  const [step, setStep] = useState(1);

  const [showPwd, setShowPwd] = useState(false);

  const [phase, setPhase] = useState<Phase>('idle');

  const [formVisible, setFormVisible] = useState(true);

  const [pricingTab, setPricingTab] = useState<'standard' | 'entreprise'>('standard');

  const pendingModeRef = useRef<Side | null>(null);

  const reformDoneRef = useRef({ top: false, bottom: false });

  /* =======================================================
     REGISTER FORM
  ======================================================= */

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      currency: 'XOF',
      country: 'SN',
    },
  });

  /* =======================================================
     LOGIN FORM
  ======================================================= */

  const {
    register: registerLogin,
    handleSubmit: handleLoginSubmit,
    formState: { errors: loginErrors, isSubmitting: isLoginSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  /* =======================================================
     REGISTER
     Redirige vers le dashboard une fois le compte créé.
  ======================================================= */

  const onSubmit = async (data: Form) => {
    try {
      await authRegister(data);

      toast.success('Bienvenue sur Your ID !');

      // Force full navigation so dashboard layout re-reads persisted auth
      if (typeof window !== 'undefined') window.location.href = '/dashboard';
    } catch (e: any) {
      toast.error(
        e.response?.data?.message ||
          'Erreur lors de la création du compte'
      );

      setStep(1);
    }
  };

  /* =======================================================
     LOGIN
     Ton store actuel (useAuthStore) n'expose pour l'instant
     qu'une méthode `register`. Dès que tu ajoutes `login` au
     store, remplace le bloc ci-dessous par :
       await authLogin(data);
  ======================================================= */

  const onLogin = async (data: LoginForm) => {
    try {
      await authLogin(data.email, data.password);

      toast.success('Connexion réussie');

      if (typeof window !== 'undefined') window.location.href = '/dashboard';
    } catch (e: any) {
      toast.error(
        e.response?.data?.message ||
          'Email ou mot de passe incorrect'
      );
    }
  };

  /* =======================================================
     CHANGEMENT DE MODE — orchestration réelle en phases

     Chaque étape ne démarre qu'à la fin RÉELLE de la précédente
     (callback Framer Motion), jamais après un délai deviné.
  ======================================================= */

  const changeMode = (nextMode: Side) => {
    if (nextMode === mode || phase !== 'idle') return;

    pendingModeRef.current = nextMode;

    // Étape 1 : le formulaire actuel sort. Le panneau vert
    // reste immobile tant que cette sortie n'est pas terminée.
    setPhase('formOut');
    setFormVisible(false);
  };

  // Le formulaire a fini de sortir → le HAUT du panneau se referme.
  const handleFormExitComplete = () => {
    if (phase === 'formOut') {
      setPhase('topCover');
    }
  };

  // Le HAUT vient de terminer son animation.
  const handleTopPanelComplete = () => {
    if (phase === 'topCover') {
      // Le haut est plein vert → le BAS se referme à son tour.
      setPhase('bottomCover');
      return;
    }

    if (phase === 'reform') {
      reformDoneRef.current.top = true;
      maybeFinishReform();
    }
  };

  // Le BAS vient de terminer son animation.
  const handleBottomPanelComplete = () => {
    if (phase === 'bottomCover') {
      // Haut ET bas sont pleins verts → on marque une vraie pause
      // "tout vert" (avec flash lumineux), PUIS on bascule le
      // contenu (invisible à ce moment précis, donc aucun saut
      // visuel), puis on reforme en ressort.
      setPhase('fullGreen');

      window.setTimeout(() => {
        const next = pendingModeRef.current;

        if (next) {
          setMode(next);
          setStep(1);
        }

        setPhase('reform');
      }, FULL_GREEN_PAUSE);

      return;
    }

    if (phase === 'reform') {
      reformDoneRef.current.bottom = true;
      maybeFinishReform();
    }
  };

  // Le panneau ne se considère "reformé" que lorsque le HAUT et
  // le BAS ont tous les deux terminé leur reformation.
  const maybeFinishReform = () => {
    if (reformDoneRef.current.top && reformDoneRef.current.bottom) {
      reformDoneRef.current = { top: false, bottom: false };
      pendingModeRef.current = null;

      setFormVisible(true);
      setPhase('idle');
    }
  };

  // Le contenu du panneau (logo / texte / CTA) ne doit être
  // visible qu'au repos, jamais pendant une transition en cours.
  const overlayVisible = phase === 'idle';
  const isFullGreen = phase === 'fullGreen';
  const isCovering = phase === 'topCover' || phase === 'bottomCover';

  // Petite respiration de la zone blanche pendant la transition : elle se
  // rétracte légèrement au fur et à mesure que le vert la recouvre, puis
  // se détend en un léger rebond quand le panneau se reforme. Discret,
  // jamais visible tant qu'on est en "idle".
  const whiteScale = isCovering ? 0.985 : isFullGreen ? 0.975 : 1;
  const whiteOpacity = isFullGreen ? 0.85 : 1;
  const whiteTransition =
    phase === 'reform'
      ? REFORM_TRANSITION
      : { duration: 0.4, ease: PANEL_EASE };

  // Le fond de page doit refléter les grandes zones du panneau,
  // mais dans l'inverse : où le vert est présent sur le formulaire,
  // le fond devient blanc, et inversement. Il suit aussi l'animation
  // lorsqu'on bascule entre login / signup.
  const backdropMode: Side = mode === 'login' ? 'signup' : 'login';
  const backdropTopClip = topShapeFor(phase, backdropMode);
  const backdropBottomClip = bottomShapeFor(phase, backdropMode);

  const steps = ['Compte', 'Boutique'];

  /* =======================================================
     SECTION TARIFS — toggle Prix / Entreprise
  ======================================================= */

  const pricingPlans = [
    {
      id: 'starter',
      name: 'Starter',
      price: 'Gratuit',
      period: '',
      description: 'Pour démarrer et tester la plateforme.',
      features: [
        'Boutique en ligne illimitée',
        'Jusqu’à 10 produits',
        'Paiements Mobile Money',
        'Support par email',
      ],
      highlighted: false,
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '9 000',
      period: 'FCFA / mois',
      description: 'Pour les créateurs qui vendent activement.',
      features: [
        'Produits illimités',
        'Statistiques avancées',
        'Automatisations marketing',
        'Support prioritaire',
      ],
      highlighted: true,
    },
    {
      id: 'business',
      name: 'Business',
      price: '29 000',
      period: 'FCFA / mois',
      description: 'Pour les équipes en forte croissance.',
      features: [
        'Multi-boutiques',
        'Rôles et permissions équipe',
        'API et intégrations',
        'Account manager dédié',
      ],
      highlighted: false,
    },
  ];

  const enterpriseFeatures = [
    'Tarification et facturation sur mesure',
    'SLA et disponibilité garantie',
    'Accès API dédié et volumes élevés',
    'Account manager et onboarding personnalisé',
    'Sécurité et conformité renforcées',
  ];

  const companyStats = [
    { value: '500+', label: 'Boutiques actives' },
    { value: '15', label: 'Pays couverts' },
    { value: '99.9%', label: 'Disponibilité' },
    { value: '24/7', label: 'Support dédié' },
  ];

  const companyHighlights = [
    {
      title: 'Notre mission',
      text: 'Donner aux créateurs, marques et entrepreneurs africains les outils pour vendre leurs produits numériques sans friction, où qu’ils soient.',
    },
    {
      title: 'Une plateforme pensée pour l’échelle',
      text: 'De la première vente au multi-boutiques en équipe, Your ID grandit avec votre activité sans jamais vous forcer à changer d’outil.',
    },
    {
      title: 'Un accompagnement humain',
      text: 'Nos équipes sont impliquées dès l’onboarding et tout au long de votre croissance, avec un interlocuteur dédié pour les comptes entreprise.',
    },
  ];

  /* =======================================================
     FOOTER
  ======================================================= */

  const footerColumns = [
    {
      title: 'Produit',
      links: ['Fonctionnalités', 'Tarifs', 'Sécurité', 'Intégrations'],
    },
    {
      title: 'Entreprise',
      links: ['À propos', 'Blog', 'Carrières', 'Contact'],
    },
    {
      title: 'Ressources',
      links: ['Centre d’aide', 'Documentation', 'API', 'Statut du service'],
    },
    {
      title: 'Légal',
      links: ['Confidentialité', 'Conditions d’utilisation', 'Cookies'],
    },
  ];

  const socialLinks = [
    { icon: Facebook, label: 'Facebook', href: '#' },
    { icon: Instagram, label: 'Instagram', href: '#' },
    { icon: Twitter, label: 'Twitter / X', href: '#' },
    { icon: Linkedin, label: 'LinkedIn', href: '#' },
  ];

  return (
    <div className="relative overflow-hidden bg-[#F6F7F6] dark:bg-neutral-950 transition-colors duration-300">
      {/* =================================================
          HERO — zone borné à la hauteur de l'écran. Le fond
          vert animé (backdrop) est en "absolute inset-0" à
          L'INTÉRIEUR de cette section uniquement : il ne peut
          donc plus s'étirer sur les sections Tarifs / Footer
          ajoutées plus bas.
      ================================================= */}
      <div className="relative min-h-screen w-full flex flex-col items-center justify-center pt-10">
      {/* =================================================
          ARRIÈRE-PLAN — sobre et professionnel : une base
          claire et neutre, une grille fine à peine visible
          pour la texture, et un halo doux qui met la carte
          en valeur sans jamais attirer l'œil sur lui-même.

          Deux variantes (claire / sombre) superposées ; seule
          celle qui correspond au thème actif est visible.
      ================================================= */}

      {/* Fond lisse pour éviter les traits derrière le panneau — mode clair */}
      <div
        className="absolute inset-0 z-0 dark:hidden"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(255,255,255,0.96) 0%, rgba(246,247,246,0.9) 34%, rgba(244,245,244,0.82) 62%, rgba(240,242,240,0.7) 100%)',
        }}
      />

      {/* Fond équivalent — mode sombre */}
      <div
        className="absolute inset-0 z-0 hidden dark:block"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(38,38,42,0.9) 0%, rgba(23,23,26,0.94) 34%, rgba(15,15,18,0.97) 62%, rgba(10,10,12,1) 100%)',
        }}
      />

      {/* Halo très doux — mode clair */}
      <div
        className="absolute inset-0 z-0 dark:hidden"
        style={{
          background:
            'radial-gradient(ellipse 820px 520px at 50% 44%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0) 72%)',
        }}
      />

      {/* Halo équivalent — mode sombre */}
      <div
        className="absolute inset-0 z-0 hidden dark:block"
        style={{
          background:
            'radial-gradient(ellipse 820px 520px at 50% 44%, rgba(64,64,70,0.35) 0%, rgba(64,64,70,0) 72%)',
        }}
      />

      {/* =================================================
          LOGO — coin supérieur gauche de la page
      ================================================= */}

      <Link
        href="/"
        className="absolute top-6 left-6 z-20 inline-flex items-center gap-2"
      >
        <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center">
          <span className="text-white font-black text-xs">YI</span>
        </div>

        <span className="font-black text-lg text-gray-900 dark:text-white">
          Your <span className="text-brand-500">ID</span>
        </span>
      </Link>

      <motion.div
        initial={false}
        animate={{ opacity: 1 }}
        className="absolute inset-0 z-0 pointer-events-none overflow-hidden"
      >
        <motion.div
          initial={false}
          animate={{ clipPath: backdropTopClip }}
          transition={phase === 'reform' ? REFORM_TRANSITION : COVER_TRANSITION}
          className="absolute inset-x-0 top-0 h-1/2 bg-white dark:bg-neutral-900"
        />

        <motion.div
          initial={false}
          animate={{ clipPath: backdropBottomClip }}
          transition={phase === 'reform' ? REFORM_TRANSITION : COVER_TRANSITION}
          className="absolute inset-x-0 bottom-0 h-1/2 bg-brand-500/90 dark:bg-brand-600/80"
        />

      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-3xl px-4"
      >
        {/* =================================================
            AUTH CONTAINER
        ================================================= */}

        <div
          className="
            relative
            overflow-hidden
            rounded-3xl
            bg-white
            dark:bg-neutral-900
            shadow-xl
            border
            border-border
            dark:border-neutral-800
            min-h-[540px]
          "
        >
          {/* =================================================
              ÉTIQUETTE DE MODE — placée au-dessus du FORMULAIRE
              (pas du panneau vert), pour rester du même côté que
              lui : login s'affiche à gauche (justify-start) donc
              son étiquette est en haut à GAUCHE ; signup s'affiche
              à droite (justify-end) donc son étiquette est en haut
              à DROITE. Toujours au-dessus (z-50) donc jamais
              recouverte ni posée sur les champs.
          ================================================= */}

          {mode === 'login' && (
            <span className="absolute top-5 left-6 z-50 text-[11px] font-semibold uppercase tracking-widest text-white/80 pointer-events-none">
              Login
            </span>
          )}

          {mode === 'signup' && (
            <span className="absolute top-5 right-6 z-50 text-[11px] font-semibold uppercase tracking-widest text-white/80 pointer-events-none">
              Sign up
            </span>
          )}

          {/* =================================================
              PANNEAU VERT — moitié HAUTE
          ================================================= */}

          <motion.div
            className="absolute top-0 left-0 right-0 h-1/2 z-30 pointer-events-none bg-brand-500"
            initial={false}
            animate={{ clipPath: topShapeFor(phase, mode) }}
            transition={phase === 'reform' ? REFORM_TRANSITION : COVER_TRANSITION}
            onAnimationComplete={handleTopPanelComplete}
          >
            <motion.div
              initial={false}
              animate={{
                opacity: overlayVisible ? 1 : 0,
                x: overlayVisible ? 0 : mode === 'login' ? 18 : -18,
                y: overlayVisible ? 0 : 16,
              }}
              transition={{ duration: 0.3, ease: FORM_EASE }}
              className={`
                absolute
                top-12
                ${mode === 'login' ? 'right-6 md:right-10' : 'left-6 md:left-10'}
                w-[170px] sm:w-[190px]
                rounded-2xl
                border border-white/35
                bg-white/10
                p-2
                backdrop-blur-sm
                shadow-lg shadow-brand-900/10
              `}
            >
              <div className="relative overflow-hidden rounded-xl border border-white/20 bg-black/10">
                <video
                  src="/video.mp4"
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="h-[100px] w-full object-cover"
                />
              </div>
            </motion.div>
          </motion.div>

          {/* =================================================
              PANNEAU VERT — moitié BASSE

              Ne commence à se refermer qu'une fois le HAUT
              terminé : c'est ce séquençage, et non un simple
              décalage de durée, qui crée l'effet de rideau
              haut → bas.
          ================================================= */}

          <motion.div
            className="absolute bottom-0 left-0 right-0 h-1/2 z-30 pointer-events-none bg-brand-500"
            initial={false}
            animate={{ clipPath: bottomShapeFor(phase, mode) }}
            transition={phase === 'reform' ? REFORM_TRANSITION : COVER_TRANSITION}
            onAnimationComplete={handleBottomPanelComplete}
          />

          {/* =================================================
              FLASH LUMINEUX — un seul balayage, uniquement
              pendant la pause "tout vert". C'est LE moment fort
              de la transition : bref, net, jamais répété en
              boucle.
          ================================================= */}

          {isFullGreen && (
            <motion.div
              className="absolute inset-0 z-35 pointer-events-none"
              initial={{ x: '-130%' }}
              animate={{ x: '130%' }}
              transition={{ duration: FULL_GREEN_PAUSE / 1000, ease: 'easeInOut' }}
              style={{
                width: '55%',
                background:
                  'linear-gradient(78deg, transparent 0%, rgba(255,255,255,0.16) 42%, rgba(255,255,255,0.32) 50%, rgba(255,255,255,0.16) 58%, transparent 100%)',
              }}
            />
          )}

          {/* =================================================
              CONTENU DU PANNEAU
              Centré par-dessus les deux moitiés, indépendant
              de leur découpe.
          ================================================= */}

          <div className="absolute inset-0 z-40 pointer-events-none">
            <motion.div
              className={`
                absolute
                top-0
                bottom-0
                ${mode === 'login' ? 'right-0' : 'left-0'}
                w-[42%]
                flex
                items-center
                justify-center
                text-white
                pointer-events-none
                px-4
              `}
              animate={{ opacity: overlayVisible ? 1 : 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="text-center max-w-[220px] relative">
                {/* lueur douce, statique, discrète — un seul point d'éclat */}
                <div className="absolute left-1/2 top-2 -translate-x-1/2 w-32 h-32 rounded-full bg-white/10 blur-3xl -z-10" />

                <motion.div
                  className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center"
                  animate={{
                    rotate: isFullGreen ? 180 : 0,
                    scale: isFullGreen ? 1.12 : 1,
                  }}
                  transition={{ duration: 0.45, ease: FORM_EASE }}
                >
                  <span className="text-xl font-black">YI</span>
                </motion.div>

                <h2 className="text-xl font-black mb-2 leading-tight">
                  {mode === 'login' ? 'Bienvenue !' : 'Bienvenue sur Your ID'}
                </h2>

                <p className="text-white/80 text-sm leading-relaxed mb-6">
                  {mode === 'login'
                    ? 'Créez votre compte et commencez à vendre vos produits numériques.'
                    : 'Votre espace pour créer, vendre et développer votre activité numérique.'}
                </p>

                <motion.button
                  type="button"
                  onClick={() =>
                    changeMode(mode === 'login' ? 'signup' : 'login')
                  }
                  disabled={!overlayVisible}
                  whileHover={overlayVisible ? { scale: 1.04 } : undefined}
                  whileTap={overlayVisible ? { scale: 0.96 } : undefined}
                  className="
                    px-5
                    py-2.5
                    text-sm
                    rounded-xl
                    border
                    border-white/50
                    text-white
                    font-semibold
                    hover:bg-white/10
                    transition-colors
                    pointer-events-auto
                    whitespace-nowrap
                  "
                >
                  {mode === 'login' ? 'Créer un compte' : 'Se connecter'}
                </motion.button>
              </div>
            </motion.div>
          </div>

          {/* =================================================
              ZONE FORMULAIRE
          ================================================= */}

          <motion.div
            className="relative z-10 min-h-[540px] bg-white dark:bg-neutral-900"
            animate={{ scale: whiteScale, opacity: whiteOpacity }}
            transition={whiteTransition}
            style={{ transformOrigin: mode === 'login' ? '0% 50%' : '100% 50%' }}
          >
            <AnimatePresence mode="wait" onExitComplete={handleFormExitComplete}>
              {/* =============================================
                  LOGIN

                  Le conteneur extérieur (key="login") ne fait
                  QUE la mise en page (flex + alignement). C'est
                  le wrapper intérieur "w-full max-w-xs", qui
                  épouse la vraie largeur du contenu, qui porte
                  désormais l'animation (glissement, flou, ET le
                  clip-path déchiré) : les dents mordent enfin sur
                  du texte/des champs visibles au lieu de tomber
                  dans le padding vide du conteneur pleine largeur.
              ============================================= */}

              {formVisible && mode === 'login' && (
                <div
                  key="login"
                  className="
                    min-h-[540px]
                    relative
                    flex
                    items-center
                    justify-start
                    px-8
                    md:px-14
                    py-6
                  "
                >
                  <motion.div
                    initial={{
                      opacity: 0,
                      x: -32,
                      rotate: -2,
                      scale: 0.98,
                      filter: 'blur(6px)',
                      clipPath: TORN_CLIP,
                    }}
                    animate={{
                      opacity: 1,
                      x: 0,
                      rotate: 0,
                      scale: 1,
                      filter: 'blur(0px)',
                      clipPath: FLAT_CLIP,
                    }}
                    exit={{
                      opacity: 0,
                      x: -32,
                      rotate: -2,
                      scale: 0.98,
                      filter: 'blur(6px)',
                      clipPath: TORN_CLIP,
                      transition: { duration: FORM_EXIT_DURATION, ease: FORM_EASE },
                    }}
                    transition={{ duration: FORM_ENTER_DURATION, ease: FORM_EASE }}
                    className="w-full max-w-xs"
                  >
                    <div className="mb-5">
                      <h1 className="text-xl font-black text-gray-900 dark:text-white leading-tight inline-block border-b-4 border-brand-500 pb-1">
                        Bon retour sur <span className="text-brand-500">Your ID</span>
                      </h1>

                      <p className="text-gray-500 dark:text-neutral-400 text-sm mt-2.5">
                        Connectez-vous à votre espace
                      </p>
                    </div>

                    <motion.form
                      onSubmit={handleLoginSubmit(onLogin)}
                      className="space-y-2.5"
                      variants={stagger}
                      initial="hidden"
                      animate="show"
                    >
                      <motion.div variants={field}>
                        <label className="label block mb-1 text-xs dark:text-neutral-300">Email</label>

                        <input
                          {...registerLogin('email')}
                          type="email"
                          placeholder="kofi@exemple.com"
                          className="input w-full py-1.5 text-sm dark:bg-neutral-800 dark:border-neutral-700 dark:text-white dark:placeholder:text-neutral-500"
                        />

                        {loginErrors.email && (
                          <p className="text-red-500 text-xs mt-1">
                            {loginErrors.email.message}
                          </p>
                        )}
                      </motion.div>

                      <motion.div variants={field}>
                        <label className="label block mb-1 text-xs dark:text-neutral-300">Mot de passe</label>

                        <div className="relative">
                          <input
                            {...registerLogin('password')}
                            type={showPwd ? 'text' : 'password'}
                            placeholder="Votre mot de passe"
                            className="input w-full py-1.5 text-sm pr-10 dark:bg-neutral-800 dark:border-neutral-700 dark:text-white dark:placeholder:text-neutral-500"
                          />

                          <button
                            type="button"
                            onClick={() => setShowPwd(!showPwd)}
                            className="
                              absolute
                              right-3
                              top-1/2
                              -translate-y-1/2
                              text-gray-400
                              dark:text-neutral-500
                            "
                          >
                            {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>

                        {loginErrors.password && (
                          <p className="text-red-500 text-xs mt-1">
                            {loginErrors.password.message}
                          </p>
                        )}
                      </motion.div>

                      <motion.button
                        variants={field}
                        type="submit"
                        disabled={isLoginSubmitting}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        className="btn-primary w-full py-1.5 text-sm mt-2"
                      >
                        {isLoginSubmitting ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            Connexion...
                          </>
                        ) : (
                          'Se connecter'
                        )}
                      </motion.button>
                    </motion.form>

                    <p className="text-center text-xs text-gray-500 dark:text-neutral-400 mt-4">
                      Pas encore de compte ?{' '}
                      <button
                        type="button"
                        onClick={() => changeMode('signup')}
                        className="text-brand-600 dark:text-brand-400 font-semibold hover:underline"
                      >
                        S'inscrire
                      </button>
                    </p>
                  </motion.div>
                </div>
              )}

              {/* =============================================
                  SIGN UP — même principe : le wrapper extérieur
                  ne fait que la mise en page, le wrapper intérieur
                  "w-full max-w-xs" porte l'animation et le
                  clip-path déchiré.
              ============================================= */}

              {formVisible && mode === 'signup' && (
                <div
                  key="signup"
                  className="
                    min-h-[540px]
                    relative
                    flex
                    items-center
                    justify-end
                    px-8
                    md:px-14
                    py-6
                  "
                >
                  <motion.div
                    initial={{
                      opacity: 0,
                      x: 32,
                      rotate: 2,
                      scale: 0.98,
                      filter: 'blur(6px)',
                      clipPath: TORN_CLIP,
                    }}
                    animate={{
                      opacity: 1,
                      x: 0,
                      rotate: 0,
                      scale: 1,
                      filter: 'blur(0px)',
                      clipPath: FLAT_CLIP,
                    }}
                    exit={{
                      opacity: 0,
                      x: 32,
                      rotate: 2,
                      scale: 0.98,
                      filter: 'blur(6px)',
                      clipPath: TORN_CLIP,
                      transition: { duration: FORM_EXIT_DURATION, ease: FORM_EASE },
                    }}
                    transition={{ duration: FORM_ENTER_DURATION, ease: FORM_EASE }}
                    className="w-full max-w-xs"
                  >
                    <div className="mb-4">
                      <h1 className="text-xl font-black text-gray-900 dark:text-white leading-tight inline-block border-b-4 border-brand-500 pb-1">
                        Créer ma <span className="text-brand-500">boutique</span>
                      </h1>

                      <p className="text-gray-500 dark:text-neutral-400 text-sm mt-2.5">
                        Gratuit — Prêt en 5 minutes
                      </p>

                      <div className="flex items-center gap-2 mt-3">
                        {steps.map((s, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <div
                              className={`
                                flex items-center gap-1.5
                                px-2.5 py-1
                                rounded-full
                                text-xs font-semibold
                                ${
                                  i + 1 === step
                                    ? 'bg-brand-500 text-white'
                                    : i + 1 < step
                                    ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300'
                                    : 'bg-gray-100 text-gray-500 dark:bg-neutral-800 dark:text-neutral-400'
                                }
                              `}
                            >
                              {i + 1 < step ? <Check size={10} /> : i + 1}
                              {s}
                            </div>

                            {i < steps.length - 1 && (
                              <ChevronRight size={13} className="text-gray-300 dark:text-neutral-600" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <form onSubmit={handleSubmit(onSubmit)}>
                      <AnimatePresence mode="wait">
                        {/* ===================================
                            STEP 1
                        =================================== */}

                        {step === 1 && (
                          <motion.div
                            key="s1"
                            variants={stagger}
                            initial="hidden"
                            animate="show"
                            exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
                            className="space-y-2"
                          >
                            <motion.div variants={field} className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="label block mb-1 text-xs dark:text-neutral-300">Prénom</label>

                                <input
                                  {...register('firstName')}
                                  placeholder="Kofi"
                                  className="input w-full py-1.5 text-sm dark:bg-neutral-800 dark:border-neutral-700 dark:text-white dark:placeholder:text-neutral-500"
                                />

                                {errors.firstName && (
                                  <p className="text-red-500 text-xs mt-1">
                                    {errors.firstName.message}
                                  </p>
                                )}
                              </div>

                              <div>
                                <label className="label block mb-1 text-xs dark:text-neutral-300">Nom</label>

                                <input
                                  {...register('lastName')}
                                  placeholder="Mensah"
                                  className="input w-full py-1.5 text-sm dark:bg-neutral-800 dark:border-neutral-700 dark:text-white dark:placeholder:text-neutral-500"
                                />
                              </div>
                            </motion.div>

                            <motion.div variants={field}>
                              <label className="label block mb-1 text-xs dark:text-neutral-300">Nom d'utilisateur</label>

                              <div className="relative">
                                <span className="
                                  absolute
                                  left-3
                                  top-1/2
                                  -translate-y-1/2
                                  text-gray-400
                                  dark:text-neutral-500
                                  text-sm
                                  pointer-events-none
                                ">
                                  @
                                </span>

                                <input
                                  {...register('username')}
                                  placeholder="kofimensah"
                                  className="input w-full py-1.5 text-sm pl-7 dark:bg-neutral-800 dark:border-neutral-700 dark:text-white dark:placeholder:text-neutral-500"
                                />
                              </div>

                              {errors.username && (
                                <p className="text-red-500 text-xs mt-1">
                                  {errors.username.message}
                                </p>
                              )}
                            </motion.div>

                            <motion.div variants={field}>
                              <label className="label block mb-1 text-xs dark:text-neutral-300">Email</label>

                              <input
                                {...register('email')}
                                type="email"
                                placeholder="kofi@exemple.com"
                                className="input w-full py-1.5 text-sm dark:bg-neutral-800 dark:border-neutral-700 dark:text-white dark:placeholder:text-neutral-500"
                              />

                              {errors.email && (
                                <p className="text-red-500 text-xs mt-1">
                                  {errors.email.message}
                                </p>
                              )}
                            </motion.div>

                            <motion.div variants={field}>
                              <label className="label block mb-1 text-xs dark:text-neutral-300">Mot de passe</label>

                              <div className="relative">
                                <input
                                  {...register('password')}
                                  type={showPwd ? 'text' : 'password'}
                                  placeholder="Min. 8 chars, 1 maj, 1 chiffre"
                                  className="input w-full py-1.5 text-sm pr-10 dark:bg-neutral-800 dark:border-neutral-700 dark:text-white dark:placeholder:text-neutral-500"
                                />

                                <button
                                  type="button"
                                  onClick={() => setShowPwd(!showPwd)}
                                  className="
                                    absolute
                                    right-3
                                    top-1/2
                                    -translate-y-1/2
                                    text-gray-400
                                    dark:text-neutral-500
                                  "
                                >
                                  {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                              </div>

                              {errors.password && (
                                <p className="text-red-500 text-xs mt-1">
                                  {errors.password.message}
                                </p>
                              )}
                            </motion.div>

                            <motion.button
                              variants={field}
                              type="button"
                              onClick={() => setStep(2)}
                              whileHover={{ scale: 1.01 }}
                              whileTap={{ scale: 0.98 }}
                              className="btn-primary w-full py-1.5 text-sm mt-2"
                            >
                              Suivant
                              <ChevronRight size={14} />
                            </motion.button>
                          </motion.div>
                        )}

                        {/* ===================================
                            STEP 2
                        =================================== */}

                        {step === 2 && (
                          <motion.div
                            key="s2"
                            variants={stagger}
                            initial="hidden"
                            animate="show"
                            exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
                            className="space-y-2"
                          >
                            <motion.div variants={field}>
                              <label className="label block mb-1 text-xs dark:text-neutral-300">Nom de la boutique</label>

                              <input
                                {...register('storeName')}
                                placeholder="Digital Africa"
                                className="input w-full py-1.5 text-sm dark:bg-neutral-800 dark:border-neutral-700 dark:text-white dark:placeholder:text-neutral-500"
                                onChange={e => {
                                  register('storeName').onChange(e);
                                  setValue('storeSlug', slugify(e.target.value));
                                }}
                              />

                              {errors.storeName && (
                                <p className="text-red-500 text-xs mt-1">
                                  {errors.storeName.message}
                                </p>
                              )}
                            </motion.div>

                            <motion.div variants={field}>
                              <label className="label block mb-1 text-xs dark:text-neutral-300">URL de la boutique</label>

                              <div className="
                                flex
                                items-center
                                border
                                border-border
                                dark:border-neutral-700
                                rounded-xl
                                overflow-hidden
                              ">
                                <span className="
                                  px-3
                                  py-1.5
                                  bg-gray-50
                                  dark:bg-neutral-800
                                  text-gray-400
                                  dark:text-neutral-500
                                  text-xs
                                  border-r
                                  border-border
                                  dark:border-neutral-700
                                  whitespace-nowrap
                                ">
                                  yourid.com/@
                                </span>

                                <input
                                  {...register('storeSlug')}
                                  className="
                                    flex-1
                                    min-w-0
                                    px-3
                                    py-1.5
                                    outline-none
                                    text-sm
                                    dark:bg-neutral-900
                                    dark:text-white
                                  "
                                />
                              </div>

                              {errors.storeSlug && (
                                <p className="text-red-500 text-xs mt-1">
                                  {errors.storeSlug.message}
                                </p>
                              )}
                            </motion.div>

                            <motion.div variants={field} className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="label block mb-1 text-xs dark:text-neutral-300">Pays</label>

                                <select {...register('country')} className="input w-full py-1.5 text-sm dark:bg-neutral-800 dark:border-neutral-700 dark:text-white">
                                  {COUNTRIES.map(c => (
                                    <option key={c.code} value={c.code}>
                                      {c.flag} {c.name}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="label block mb-1 text-xs dark:text-neutral-300">Devise</label>

                                <select {...register('currency')} className="input w-full py-1.5 text-sm dark:bg-neutral-800 dark:border-neutral-700 dark:text-white">
                                  {CURRENCIES.map(c => (
                                    <option key={c.code} value={c.code}>
                                      {c.code} – {c.symbol}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </motion.div>

                            <motion.div variants={field} className="flex gap-2 pt-2">
                              <button
                                type="button"
                                onClick={() => setStep(1)}
                                className="btn-secondary flex-1 py-1.5 text-sm dark:bg-neutral-800 dark:text-white dark:border-neutral-700"
                              >
                                Retour
                              </button>

                              <motion.button
                                type="submit"
                                disabled={isSubmitting}
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.98 }}
                                className="btn-primary flex-1 py-1.5 text-sm"
                              >
                                {isSubmitting ? (
                                  <>
                                    <Loader2 size={14} className="animate-spin" />
                                    Création...
                                  </>
                                ) : (
                                  "S'inscrire →"
                                )}
                              </motion.button>
                            </motion.div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </form>

                    <p className="text-center text-xs text-gray-500 dark:text-neutral-400 mt-4">
                      Déjà un compte ?{' '}
                      <button
                        type="button"
                        onClick={() => changeMode('login')}
                        className="text-brand-600 dark:text-brand-400 font-semibold hover:underline"
                      >
                        Se connecter
                      </button>
                    </p>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </motion.div>

      {/* =================================================
          SECTION TARIFS
          Un toggle central (Prix / Entreprise) fait basculer
          le contenu affiché juste en dessous.
      ================================================= */}

      <div className="relative z-10 w-full max-w-5xl px-4 mx-auto mt-16 mb-16">
        <div className="flex justify-center mb-10">
          <div className="inline-flex items-center gap-1 rounded-full border border-border dark:border-neutral-700 bg-white dark:bg-neutral-900 p-1 shadow-sm">
            {(['standard', 'entreprise'] as const).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setPricingTab(tab)}
                className="relative px-6 py-2.5 rounded-full text-sm font-semibold"
              >
                {pricingTab === tab && (
                  <motion.span
                    layoutId="pricing-tab-bg"
                    className="absolute inset-0 bg-brand-500 rounded-full"
                    transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                  />
                )}

                <span
                  className={`relative z-10 ${
                    pricingTab === tab
                      ? 'text-white'
                      : 'text-gray-600 dark:text-neutral-300'
                  }`}
                >
                  {tab === 'standard' ? 'Prix' : 'Entreprise'}
                </span>
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {pricingTab === 'standard' ? (
            <motion.div
              key="standard"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3, ease: FORM_EASE }}
              className="grid grid-cols-1 md:grid-cols-3 gap-6"
            >
              {pricingPlans.map(plan => (
                <div
                  key={plan.id}
                  className={`relative rounded-3xl border p-8 bg-white dark:bg-neutral-900 flex flex-col ${
                    plan.highlighted
                      ? 'border-brand-500 shadow-xl shadow-brand-500/10 ring-1 ring-brand-500 md:-translate-y-2'
                      : 'border-border dark:border-neutral-800'
                  }`}
                >
                  {plan.highlighted && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-500 text-white text-[11px] font-semibold uppercase tracking-wide px-4 py-1.5">
                      Populaire
                    </span>
                  )}

                  <h3 className="text-xl font-black text-gray-900 dark:text-white">
                    {plan.name}
                  </h3>

                  <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1.5">
                    {plan.description}
                  </p>

                  <div className="mt-6 flex items-baseline gap-1.5">
                    <span className="text-4xl font-black text-gray-900 dark:text-white">
                      {plan.price}
                    </span>
                    {plan.period && (
                      <span className="text-sm text-gray-500 dark:text-neutral-400">
                        {plan.period}
                      </span>
                    )}
                  </div>

                  <ul className="mt-7 space-y-3 flex-1">
                    {plan.features.map(feature => (
                      <li
                        key={feature}
                        className="flex items-start gap-2.5 text-sm text-gray-700 dark:text-neutral-300"
                      >
                        <Check size={16} className="text-brand-500 shrink-0 mt-0.5" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    className={
                      plan.highlighted
                        ? 'btn-primary w-full py-3 text-sm mt-8'
                        : 'btn-secondary w-full py-3 text-sm mt-8 dark:bg-neutral-800 dark:text-white dark:border-neutral-700'
                    }
                  >
                    Choisir {plan.name}
                  </button>
                </div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="entreprise"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3, ease: FORM_EASE }}
              className="space-y-6"
            >
              <div className="rounded-3xl border border-border dark:border-neutral-800 bg-white dark:bg-neutral-900 p-10 flex flex-col md:flex-row items-center gap-10">
                <div className="flex-1">
                  <h3 className="text-2xl font-black text-gray-900 dark:text-white">
                    Solution sur mesure pour votre entreprise
                  </h3>

                  <p className="text-base text-gray-500 dark:text-neutral-400 mt-3 leading-relaxed">
                    Volumes élevés, besoins spécifiques ou plusieurs équipes à gérer ? Parlons de la
                    meilleure façon d’adapter Your ID à votre activité.
                  </p>

                  <ul className="mt-7 space-y-3">
                    {enterpriseFeatures.map(feature => (
                      <li
                        key={feature}
                        className="flex items-start gap-2.5 text-sm text-gray-700 dark:text-neutral-300"
                      >
                        <Check size={16} className="text-brand-500 shrink-0 mt-0.5" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="w-full md:w-auto shrink-0">
                  <button
                    type="button"
                    className="btn-primary w-full md:w-auto px-8 py-3 text-sm whitespace-nowrap"
                  >
                    Contacter les ventes
                  </button>
                </div>
              </div>

              {/* =========================================
                  PRÉSENTATION GLOBALE — au-delà de l'offre
                  entreprise, un aperçu plus large de Your ID :
                  chiffres clés puis mission/positionnement.
              ========================================= */}

              <div className="rounded-3xl border border-border dark:border-neutral-800 bg-white dark:bg-neutral-900 p-10">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pb-8 border-b border-border dark:border-neutral-800">
                  {companyStats.map(stat => (
                    <div key={stat.label} className="text-center">
                      <p className="text-3xl font-black text-brand-500">{stat.value}</p>
                      <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1">
                        {stat.label}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-8">
                  {companyHighlights.map(item => (
                    <div key={item.title}>
                      <h4 className="text-sm font-black text-gray-900 dark:text-white">
                        {item.title}
                      </h4>
                      <p className="text-sm text-gray-500 dark:text-neutral-400 mt-2 leading-relaxed">
                        {item.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      </div>

      {/* =================================================
          FOOTER
          Pleine largeur (w-full), en dehors du max-w des
          sections précédentes : logo + colonnes de liens,
          réseaux sociaux, puis barre de copyright.
      ================================================= */}

      <footer className="relative z-10 w-full border-t border-border dark:border-neutral-800 bg-gray-50 dark:bg-neutral-950">
        <div className="max-w-5xl mx-auto px-6 py-14">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-10">
            <div className="col-span-2">
              <div className="inline-flex items-center gap-2">
                <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center">
                  <span className="text-white font-black text-xs">YI</span>
                </div>

                <span className="font-black text-lg text-gray-900 dark:text-white">
                  Your <span className="text-brand-500">ID</span>
                </span>
              </div>

              <p className="text-sm text-gray-500 dark:text-neutral-400 mt-4 leading-relaxed max-w-xs">
                La plateforme pour créer, vendre et développer votre activité numérique, sans
                friction.
              </p>

              <div className="flex items-center gap-3 mt-6">
                {socialLinks.map(social => (
                  <a
                    key={social.label}
                    href={social.href}
                    aria-label={social.label}
                    className="
                      flex h-9 w-9 items-center justify-center rounded-full
                      border border-border dark:border-neutral-700
                      text-gray-500 dark:text-neutral-400
                      hover:text-brand-500 hover:border-brand-500
                      transition-colors
                    "
                  >
                    <social.icon size={16} />
                  </a>
                ))}
              </div>
            </div>

            {footerColumns.map(column => (
              <div key={column.title}>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-900 dark:text-white">
                  {column.title}
                </h4>

                <ul className="mt-4 space-y-2.5">
                  {column.links.map(link => (
                    <li key={link}>
                      <a
                        href="#"
                        className="text-sm text-gray-500 dark:text-neutral-400 hover:text-brand-500 dark:hover:text-brand-400 transition-colors"
                      >
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-12 pt-6 border-t border-border dark:border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-gray-500 dark:text-neutral-500">
              © {new Date().getFullYear()} Your ID. Tous droits réservés.
            </p>

            <a
              href="mailto:contact@yourid.com"
              className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-neutral-400 hover:text-brand-500 dark:hover:text-brand-400 transition-colors"
            >
              <Mail size={13} />
              contact@yourid.com
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}