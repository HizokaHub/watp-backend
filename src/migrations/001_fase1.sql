-- Perfil de usuario extendido
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username VARCHAR(30) UNIQUE NOT NULL,
  display_name VARCHAR(60),
  bio TEXT,
  avatar_url TEXT,
  account_type VARCHAR(10) DEFAULT 'user' CHECK (account_type IN ('user', 'empresa')),
  coins INTEGER DEFAULT 0,
  followers_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  visits_count INTEGER DEFAULT 0,
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Calle de cada usuario (su mundo 3D)
CREATE TABLE IF NOT EXISTS calles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  username VARCHAR(30) NOT NULL,
  world_data JSONB DEFAULT '{"objects": []}',
  nivel INTEGER DEFAULT 1,
  visits_count INTEGER DEFAULT 0,
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Canales/tiendas dentro de una calle
CREATE TABLE IF NOT EXISTS canales_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calle_id UUID NOT NULL REFERENCES calles(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name VARCHAR(60) NOT NULL,
  description TEXT,
  category VARCHAR(60),
  subcategory VARCHAR(60),
  tipo VARCHAR(20) DEFAULT 'canal' CHECK (tipo IN ('canal', 'tienda', 'stream')),
  world_data JSONB DEFAULT '{"objects": []}',
  chat_enabled BOOLEAN DEFAULT true,
  is_public BOOLEAN DEFAULT true,
  visits_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comunidades
CREATE TABLE IF NOT EXISTS comunidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(60) UNIQUE NOT NULL,
  descripcion TEXT,
  parent_id UUID REFERENCES comunidades(id),
  nivel CHAR(1) DEFAULT 'A' CHECK (nivel IN ('A','B','C','D')),
  creado_por UUID REFERENCES profiles(id),
  members_count INTEGER DEFAULT 0,
  is_official BOOLEAN DEFAULT false,
  min_peticiones INTEGER DEFAULT 50,
  peticiones_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Membresía de usuarios en comunidades
CREATE TABLE IF NOT EXISTS comunidad_members (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  comunidad_id UUID REFERENCES comunidades(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, comunidad_id)
);

-- Contenido subido por usuarios
CREATE TABLE IF NOT EXISTS contenido (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  calle_id UUID REFERENCES calles(id),
  canal_id UUID REFERENCES canales_v2(id),
  comunidad_id UUID REFERENCES comunidades(id),
  tipo VARCHAR(20) CHECK (tipo IN ('imagen', 'video', 'stream', 'post')),
  url TEXT,
  thumbnail_url TEXT,
  titulo VARCHAR(120),
  descripcion TEXT,
  likes_count INTEGER DEFAULT 0,
  views_count INTEGER DEFAULT 0,
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seguimiento entre usuarios
CREATE TABLE IF NOT EXISTS follows (
  follower_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id)
);

-- Insertar comunidades oficiales iniciales
INSERT INTO comunidades (nombre, descripcion, nivel, is_official, min_peticiones) VALUES
('Pet', 'Mascotas y animales', 'A', true, 0),
('Gaming', 'Videojuegos y esports', 'A', true, 0),
('Música', 'Todo sobre música', 'A', true, 0),
('Tecnología', 'Tech, programación, IA', 'A', true, 0),
('Deporte', 'Deportes y fitness', 'A', true, 0),
('Arte', 'Arte, diseño y creatividad', 'A', true, 0),
('Educación', 'Aprendizaje y conocimiento', 'A', true, 0),
('Emprendimiento', 'Negocios y startups', 'A', true, 0),
('Entretenimiento', 'Shows, películas, series', 'A', true, 0),
('Lifestyle', 'Estilo de vida y bienestar', 'A', true, 0)
ON CONFLICT DO NOTHING;
