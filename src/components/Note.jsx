import React, { useState, useEffect } from 'react';
import { Rnd } from 'react-rnd';
import { MdClose, MdPalette, MdEdit, MdCheck, MdKeyboardArrowUp, MdKeyboardArrowDown, MdAccessAlarm } from 'react-icons/md';
import ReactMarkdown from 'react-markdown';
import './Note.css';

const Note = ({ note, updateNote, deleteNote, bringToFront, colors, t }) => {
  const [showColors, setShowColors] = useState(false);
  const [showAlarmPicker, setShowAlarmPicker] = useState(false);
  const [alarmInput, setAlarmInput] = useState('');
  const [isRinging, setIsRinging] = useState(false);

  const isEditing = note.isEditing !== undefined ? note.isEditing : true;
  const isMinimized = note.isMinimized !== undefined ? note.isMinimized : false;

  useEffect(() => {
    let interval;
    if (note.alarmTime && !isRinging) {
      interval = setInterval(() => {
        const now = new Date().getTime();
        const alarm = new Date(note.alarmTime).getTime();
        if (now >= alarm) {
          setIsRinging(true);
          
          // Suona un allarme acustico: biip biip biip
          try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const playBeep = (delay) => {
              setTimeout(() => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.frequency.value = 880;
                gain.gain.value = 0.2;
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
                setTimeout(() => osc.stop(), 200);
              }, delay);
            };

            playBeep(0);
            playBeep(700);
            playBeep(1400);
          } catch(e) { console.error("Audio error", e); }

          if (window.electron && window.electron.showNotification) {
            const body = note.text ? note.text : (t ? t.emptyNote : 'Nota vuota');
            const title = t ? t.alarmExpired : 'Sveglia scaduta!';
            window.electron.showNotification(title, body);
          }
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [note.alarmTime, isRinging, note.text, t]);

  const handleDragStop = (e, d) => {
    updateNote(note.id, { x: d.x, y: d.y });
  };

  const handleResizeStop = (e, direction, ref, delta, position) => {
    if (isMinimized) return;
    updateNote(note.id, {
      width: parseInt(ref.style.width, 10),
      height: parseInt(ref.style.height, 10),
      ...position,
    });
  };

  const handleChange = (e) => {
    updateNote(note.id, { text: e.target.value });
  };

  const changeColor = (color) => {
    updateNote(note.id, { color });
    setShowColors(false);
  };

  const toggleMinimize = () => {
    updateNote(note.id, { isMinimized: !isMinimized });
  };

  const toggleEdit = () => {
    updateNote(note.id, { isEditing: !isEditing });
  };

  const setAlarm = () => {
    if (alarmInput) {
      updateNote(note.id, { alarmTime: alarmInput });
      setShowAlarmPicker(false);
      setIsRinging(false);
    }
  };

  const clearAlarm = () => {
    updateNote(note.id, { alarmTime: null });
    setShowAlarmPicker(false);
    setIsRinging(false);
    setAlarmInput('');
  };

  const handleAlarmClick = () => {
    if (isRinging) {
      clearAlarm();
    } else {
      setShowAlarmPicker(!showAlarmPicker);
    }
  };

  return (
    <Rnd
      default={{
        x: note.x,
        y: note.y,
        width: note.width,
        height: isMinimized ? 40 : note.height,
      }}
      position={{ x: note.x, y: note.y }}
      size={{ width: note.width, height: isMinimized ? 40 : note.height }}
      onDragStop={handleDragStop}
      onResizeStop={handleResizeStop}
      bounds=".board"
      dragHandleClassName="note-header"
      minWidth={200}
      minHeight={isMinimized ? 40 : 200}
      enableResizing={!isMinimized}
      onDragStart={() => bringToFront(note.id)}
      style={{ zIndex: (note.zIndex || 1) + (showColors || showAlarmPicker ? 100 : 0) }}
    >
      <div
        className={`note ${note.color.text === 'light' ? 'light-text' : 'dark-text'} ${isMinimized ? 'minimized' : ''} ${isRinging ? 'ringing' : ''}`}
        onMouseDownCapture={() => bringToFront(note.id)}
        style={{
          background: note.color.bg,
          width: '100%',
          height: '100%'
        }}
      >
        <div className="note-header" onDoubleClick={toggleMinimize}>
          <div className="note-actions" onDoubleClick={(e) => e.stopPropagation()}>
            <button className="action-btn" onClick={toggleMinimize} title={t.minimize}>
              {isMinimized ? <MdKeyboardArrowDown /> : <MdKeyboardArrowUp />}
            </button>
            {!isMinimized && (
              <button className="action-btn" onClick={toggleEdit} title={t.editText}>
                {isEditing ? <MdCheck /> : <MdEdit />}
              </button>
            )}
            <button className="action-btn" onClick={() => setShowColors(!showColors)} title={t.changeColor}>
              <MdPalette />
            </button>
            <button 
              className="action-btn" 
              onClick={handleAlarmClick} 
              title={t.alarm}
              style={{ color: note.alarmTime ? (isRinging ? '#ff4444' : '#00aa00') : '' }}
            >
              <MdAccessAlarm />
            </button>
          </div>
          <div className="note-actions" onDoubleClick={(e) => e.stopPropagation()}>
            <button className="action-btn" onClick={() => deleteNote(note.id)} title={t.moveToTrash}>
              <MdClose />
            </button>
          </div>
        </div>
        
        {showColors && (
          <div className="color-picker">
            {colors.map(c => (
              <div
                key={c.id}
                className="color-dot"
                style={{ background: c.bg, border: note.color.id === c.id ? '2px solid #000' : '2px solid transparent' }}
                onClick={() => changeColor(c)}
              />
            ))}
          </div>
        )}

        {showAlarmPicker && (
          <div className="alarm-picker">
            <label>{t.setAlarm}</label>
            <input 
              type="datetime-local" 
              value={alarmInput} 
              onChange={(e) => setAlarmInput(e.target.value)}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={setAlarm} style={{ flex: 1 }}>{t.save}</button>
              {note.alarmTime && (
                <button onClick={clearAlarm} style={{ flex: 1, backgroundColor: '#ff4444' }}>{t.remove}</button>
              )}
            </div>
          </div>
        )}

        {!isMinimized && (
          <div className="note-body">
            {isEditing ? (
              <textarea
                className="note-content"
                value={note.text}
                onChange={handleChange}
                placeholder={t.writeNote}
                spellCheck="false"
              />
            ) : (
              <div className="note-markdown" onDoubleClick={toggleEdit}>
                <ReactMarkdown>{note.text || `*${t.emptyNote}*`}</ReactMarkdown>
              </div>
            )}
          </div>
        )}
      </div>
    </Rnd>
  );
};

export default Note;
