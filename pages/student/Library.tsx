import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { LibraryResource } from '../../types';

const Library: React.FC = () => {
  const { libraryResources, currentUser, students, academySettings, toggleResourceCompletion } = useStore();
  const [filter, setFilter] = useState('All');
  const [selectedResource, setSelectedResource] = useState<LibraryResource | null>(null);
  const categories = ['All', 'Technique', 'Mindset', 'Sparring', 'History'];

  const student = students.find(s => s.id === currentUser?.studentId);
  const currentRank = academySettings.ranks.find(r => r.id === student?.rankId);

  const filteredResources = libraryResources.filter(resource => {
      const categoryMatch = filter === 'All' || resource.category === filter;
      const resourceRank = academySettings.ranks.find(r => r.name === resource.level);
      let rankAccess = true;
      if (resourceRank && currentRank) {
          if (currentRank.order < resourceRank.order) rankAccess = false;
      }
      return categoryMatch && rankAccess;
  });

  const getEmbedUrl = (url: string) => {
      if (url.includes('youtube.com') || url.includes('youtu.be')) {
          let videoId = '';
          if (url.includes('v=')) videoId = url.split('v=')[1].split('&')[0];
          else if (url.includes('youtu.be/')) videoId = url.split('youtu.be/')[1];
          return `https://www.youtube.com/embed/${videoId}?autoplay=1&modestbranding=1&rel=0`;
      }
      return url;
  };

  const handleToggleComplete = () => {
      if(selectedResource && student) toggleResourceCompletion(selectedResource.id, student.id);
  };

  const isCompleted = (resource: LibraryResource) => student && resource.completedBy.includes(student.id);

  return (
    <div className="flex flex-col h-full overflow-y-auto animate-in fade-in duration-500" style={{backgroundColor: 'var(--color-bg-app)'}}>

      {/* HEADER BANNER */}
      <div className="px-6 py-8 md:px-10 md:py-10 relative overflow-hidden shrink-0 border-b"
           style={{backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)'}}>
        <div className="absolute inset-0 pointer-events-none"
             style={{background: 'radial-gradient(circle at 85% 0%, rgba(252, 111, 111, 0.06) 0%, transparent 55%)'}}></div>
        <div className="absolute top-0 right-10 p-6 opacity-[0.03]">
          <span className="material-symbols-outlined text-[130px]" style={{color: '#FC6F6F'}}>local_library</span>
        </div>
        <div className="relative z-10 max-w-[1400px] mx-auto w-full flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tighter leading-tight mb-2"
                style={{color: 'var(--color-text-primary)'}}>
              Biblioteca Técnica
            </h1>
            <p className="text-[12px] font-medium" style={{color: 'var(--color-text-secondary)'}}>
              Curada para tu nivel:{' '}
              <span className="font-bold px-2 py-0.5 rounded-md"
                    style={{color: '#FC6F6F', backgroundColor: 'rgba(252, 111, 111, 0.1)', border: '1px solid rgba(252, 111, 111, 0.2)'}}>
                {student?.rank}
              </span>
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {categories.map(cat => (
              <button key={cat} onClick={() => setFilter(cat)}
                className="px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all"
                style={filter === cat
                  ? {backgroundColor: 'rgba(252, 111, 111, 0.15)', color: '#FC6F6F', border: '1px solid rgba(252, 111, 111, 0.35)'}
                  : {backgroundColor: 'var(--color-bg-app)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border-subtle)'}}
                onMouseEnter={e => { if (filter !== cat) (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border-strong)'; }}
                onMouseLeave={e => { if (filter !== cat) (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border-subtle)'; }}
              >{cat}</button>
            ))}
          </div>
        </div>
      </div>

      {/* GRID */}
      <div className="flex-1 p-6 md:p-10 max-w-[1400px] mx-auto w-full">
        {filteredResources.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="size-24 rounded-full flex items-center justify-center mb-6"
                 style={{backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)'}}>
              <span className="material-symbols-outlined text-5xl" style={{color: 'var(--color-border-strong)'}}>lock_clock</span>
            </div>
            <h3 className="text-lg font-black mb-2 tracking-tight" style={{color: 'var(--color-text-primary)'}}>Contenido Bloqueado</h3>
            <p className="text-sm max-w-xs" style={{color: 'var(--color-text-muted)'}}>
              Sigue avanzando de rango para desbloquear más técnicas o selecciona otra categoría.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredResources.map((resource) => (
              <div key={resource.id} onClick={() => setSelectedResource(resource)}
                className="group rounded-[20px] border overflow-hidden cursor-pointer flex flex-col transition-all"
                style={{backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)'}}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.borderColor = 'rgba(167,139,250,0.3)';
                  el.style.transform = 'translateY(-3px)';
                  el.style.boxShadow = '0 16px 40px -10px rgba(0,0,0,0.5)';
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.borderColor = 'var(--color-border-subtle)';
                  el.style.transform = 'translateY(0)';
                  el.style.boxShadow = 'none';
                }}
              >
                <div className="relative aspect-video overflow-hidden" style={{backgroundColor: 'var(--color-bg-app)'}}>
                  <img src={resource.thumbnailUrl} alt={resource.title}
                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500" />
                  <div className="absolute inset-0 flex items-center justify-center"
                       style={{background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 60%)'}}>
                    <div className="size-12 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all duration-300"
                         style={{backgroundColor: 'rgba(167,139,250,0.9)', backdropFilter: 'blur(8px)'}}>
                      <span className="material-symbols-outlined filled text-2xl ml-0.5 text-white">play_arrow</span>
                    </div>
                  </div>
                  <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide"
                       style={{backgroundColor: 'rgba(0,0,0,0.7)', color: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(4px)'}}>
                    {resource.duration}
                  </div>
                  {isCompleted(resource) && (
                    <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"
                         style={{backgroundColor: 'rgba(52, 211, 153, 0.9)', color: '#fff', backdropFilter: 'blur(4px)'}}>
                      <span className="material-symbols-outlined text-xs">check</span> Entrenado
                    </div>
                  )}
                </div>
                <div className="p-5 flex flex-col gap-3 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md"
                          style={{backgroundColor: 'rgba(167,139,250,0.1)', color: '#FC6F6F', border: '1px solid rgba(167,139,250,0.2)'}}>
                      {resource.category}
                    </span>
                    <span className="text-[10px] font-bold" style={{color: 'var(--color-text-muted)'}}>{resource.level}</span>
                  </div>
                  <h3 className="text-sm font-black leading-tight tracking-tight" style={{color: 'var(--color-text-primary)'}}>
                    {resource.title}
                  </h3>
                  <p className="text-xs leading-relaxed line-clamp-2" style={{color: 'var(--color-text-secondary)'}}>
                    {resource.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* VIDEO MODAL */}
      {selectedResource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
             style={{backgroundColor: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(8px)'}}
             onClick={() => setSelectedResource(null)}>
          <div className="w-full max-w-5xl rounded-[28px] overflow-hidden shadow-2xl flex flex-col relative border"
               style={{backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)'}}
               onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedResource(null)}
              className="absolute top-4 right-4 z-20 size-10 rounded-full flex items-center justify-center transition-all"
              style={{backgroundColor: 'rgba(255,255,255,0.08)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-subtle)'}}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.14)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.08)'}
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <div className="grid grid-cols-1 lg:grid-cols-3" style={{height: '80vh', maxHeight: '80vh'}}>
              <div className="lg:col-span-2 bg-black flex items-center justify-center relative aspect-video lg:aspect-auto">
                <iframe className="w-full h-full absolute inset-0"
                  src={getEmbedUrl(selectedResource.videoUrl)} title={selectedResource.title}
                  frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen></iframe>
              </div>
              <div className="flex flex-col h-full overflow-y-auto border-l"
                   style={{backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)'}}>
                <div className="p-8 flex-1">
                  <div className="flex items-center gap-2 mb-5">
                    <span className="px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest"
                          style={{backgroundColor: 'rgba(167,139,250,0.1)', color: '#FC6F6F', border: '1px solid rgba(167,139,250,0.2)'}}>
                      {selectedResource.category}
                    </span>
                    <span className="px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest"
                          style={{backgroundColor: 'rgba(56,189,248,0.1)', color: '#38BDF8', border: '1px solid rgba(56,189,248,0.2)'}}>
                      {selectedResource.level}
                    </span>
                  </div>
                  <h2 className="text-xl font-black leading-tight tracking-tight mb-4" style={{color: 'var(--color-text-primary)'}}>
                    {selectedResource.title}
                  </h2>
                  <p className="text-sm leading-relaxed" style={{color: 'var(--color-text-secondary)'}}>
                    {selectedResource.description}
                  </p>
                </div>
                <div className="p-8 border-t" style={{borderColor: 'var(--color-border-subtle)'}}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-5" style={{color: 'var(--color-text-muted)'}}>
                    Progreso de Entrenamiento
                  </p>
                  <button onClick={handleToggleComplete}
                    className="w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-bold text-sm transition-all active:scale-95"
                    style={isCompleted(selectedResource)
                      ? {backgroundColor: 'rgba(52,211,153,0.15)', color: '#34D399', border: '1px solid rgba(52,211,153,0.3)'}
                      : {backgroundColor: 'rgba(167,139,250,0.1)', color: '#FC6F6F', border: '1px solid rgba(167,139,250,0.3)'}}>
                    <div className={`size-5 rounded-full border-2 flex items-center justify-center ${isCompleted(selectedResource) ? 'border-emerald-400 bg-emerald-400/20' : 'border-violet-400'}`}>
                      {isCompleted(selectedResource) && <span className="material-symbols-outlined text-xs text-emerald-400">check</span>}
                    </div>
                    <span>{isCompleted(selectedResource) ? 'Técnica Completada ✓' : 'Marcar como Entrenado'}</span>
                  </button>
                  <p className="text-[10px] text-center mt-3" style={{color: 'var(--color-text-muted)'}}>
                    Notificará a tu maestro al completar.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Library;