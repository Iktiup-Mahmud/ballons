import mongoose from 'mongoose';

const submissionSchema = new mongoose.Schema({
  contestId: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  teamName: {
    type: String,
    required: true,
    trim: true
  },
  problemCode: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  time: {
    type: String,
    required: true
  },
  balloonStatus: {
    type: String,
    enum: ['waiting', 'delivered'],
    default: 'waiting'
  },
  submissionTime: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Create a compound index to prevent duplicate submissions per contest
submissionSchema.index({ contestId: 1, teamName: 1, problemCode: 1 }, { unique: true });

const Submission = mongoose.model('Submission', submissionSchema);

export default Submission;
